import { CleaningJob, RouteOptimizationResult } from '../types';

// Approximate coordinates lookup for UK postcode outward codes and sample postcodes
const UK_POSTCODE_COORDS: Record<string, { lat: number; lng: number }> = {
  'NW1 6XE': { lat: 51.5237, lng: -0.1585 }, // Baker Street (Jhonatan)
  'E1 6AN': { lat: 51.5173, lng: -0.0735 }, // Commercial St (Waylla)
  'SW11 1AA': { lat: 51.4700, lng: -0.1680 }, // Battersea Park Rd (Maria Silva)
  'W11 3HP': { lat: 51.5120, lng: -0.2070 }, // Kensington Park Gardens (Scott)
  'W1J 8AJ': { lat: 51.5074, lng: -0.1425 }, // Mayfair
  'EC2N 4BQ': { lat: 51.5152, lng: -0.0827 }, // Bishopsgate / City
  'W8 4PE': { lat: 51.5015, lng: -0.1918 }, // Kensington
  'SE10 9LZ': { lat: 51.4826, lng: 0.0077 }, // Greenwich
  'NW1 8AG': { lat: 51.5413, lng: -0.1462 }, // Camden
  'SW1V 1RB': { lat: 51.4922, lng: -0.1408 }, // Victoria/Belgrave
  'N1 9AL': { lat: 51.5332, lng: -0.1061 }, // Islington
  'M3 2AY': { lat: 53.4808, lng: -2.2426 }, // Manchester Deansgate
  'KT9 1BH': { lat: 51.3653, lng: -0.3082 }, // Operational Base / Chessington Depot
  // Outward code area fallbacks
  'SW11': { lat: 51.4700, lng: -0.1680 },
  'NW1': { lat: 51.5300, lng: -0.1500 },
  'E1': { lat: 51.5170, lng: -0.0700 },
  'W11': { lat: 51.5120, lng: -0.2070 },
  'SW1': { lat: 51.5010, lng: -0.1410 },
  'W1': { lat: 51.5130, lng: -0.1320 },
  'EC1': { lat: 51.5180, lng: -0.0990 },
  'N1': { lat: 51.5320, lng: -0.1060 },
  'W8': { lat: 51.5010, lng: -0.1920 },
  'SE1': { lat: 51.5040, lng: -0.0930 },
  'KT9': { lat: 51.3650, lng: -0.3080 },
};

/**
 * Parses or estimates lat/lng for a UK postcode
 */
export function getPostcodeCoords(postcode: string): { lat: number; lng: number } {
  const clean = postcode.toUpperCase().trim();
  if (UK_POSTCODE_COORDS[clean]) {
    return UK_POSTCODE_COORDS[clean];
  }

  // Check outward code (first part of postcode, e.g. "SW11" from "SW11 1AA")
  const prefix = clean.split(' ')[0];
  if (UK_POSTCODE_COORDS[prefix]) {
    return UK_POSTCODE_COORDS[prefix];
  }

  let hash = 0;
  for (let i = 0; i < prefix.length; i++) {
    hash += prefix.charCodeAt(i);
  }

  // London default bounding area
  const latOffset = ((hash % 100) - 50) / 1000;
  const lngOffset = (((hash * 13) % 100) - 50) / 1000;

  return {
    lat: 51.5074 + latOffset,
    lng: -0.1278 + lngOffset,
  };
}

/**
 * Calculates distance in miles between two coordinate points
 */
export function calculateHaversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistance = R * c;

  // Road factor multiplier (~1.3x for UK streets)
  return Math.round(straightDistance * 1.3 * 10) / 10;
}

/**
 * Optimizes the route sequence starting from cleaner base or live GPS coordinates using Nearest Neighbor TSP
 */
export function optimizeRoute(
  originPostcode: string,
  originAddress: string,
  jobs: CleaningJob[],
  customStartCoords?: { lat: number; lng: number }
): RouteOptimizationResult {
  if (jobs.length === 0) {
    return {
      originPostcode,
      originAddress,
      jobsInOrder: [],
      totalDistanceMiles: 0,
      totalTravelTimeMinutes: 0,
      googleMapsUrl: '',
      wazeUrl: '',
    };
  }

  const startCoords = customStartCoords || getPostcodeCoords(originPostcode);
  const unvisited = [...jobs];
  const orderedJobs: CleaningJob[] = [];

  let currentCoords = startCoords;
  let totalDistanceMiles = 0;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const jobCoords = getPostcodeCoords(unvisited[i].postcode);
      const dist = calculateHaversineMiles(
        currentCoords.lat,
        currentCoords.lng,
        jobCoords.lat,
        jobCoords.lng
      );

      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextJob = unvisited.splice(nearestIndex, 1)[0];
    orderedJobs.push(nextJob);
    totalDistanceMiles += minDistance;
    currentCoords = getPostcodeCoords(nextJob.postcode);
  }

  // Estimated driving time assuming 22 mph average urban/suburban UK driving speed + 5 min traffic buffer per stop
  const drivingHours = totalDistanceMiles / 22;
  const totalTravelTimeMinutes = Math.round(drivingHours * 60 + orderedJobs.length * 4);

  // Build Google Maps Multi-Stop URL
  const originStr = customStartCoords
    ? `${customStartCoords.lat},${customStartCoords.lng}`
    : `${originAddress}, ${originPostcode}`;

  const googlePath = [
    encodeURIComponent(originStr),
    ...orderedJobs.map((j) => encodeURIComponent(`${j.address}, ${j.postcode}`)),
  ].join('/');
  const googleMapsUrl = `https://www.google.com/maps/dir/${googlePath}`;

  // Waze link for the first stop or multi-stop
  const firstStopCoords = getPostcodeCoords(orderedJobs[0].postcode);
  const wazeUrl = `https://waze.com/ul?ll=${firstStopCoords.lat},${firstStopCoords.lng}&navigate=yes`;

  return {
    originPostcode,
    originAddress,
    jobsInOrder: orderedJobs,
    totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
    totalTravelTimeMinutes,
    googleMapsUrl,
    wazeUrl,
  };
}
