import { CleaningJob, RouteOptimizationResult } from '../types';

// Approximate coordinates lookup for UK postcode outward codes and sample postcodes
const UK_POSTCODE_COORDS: Record<string, { lat: number; lng: number }> = {
  'NW1 6XE': { lat: 51.5237, lng: -0.1585 }, // Baker Street
  'W1J 8AJ': { lat: 51.5074, lng: -0.1425 }, // Mayfair
  'EC2N 4BQ': { lat: 51.5152, lng: -0.0827 }, // Bishopsgate / City
  'W8 4PE': { lat: 51.5015, lng: -0.1918 }, // Kensington
  'SE10 9LZ': { lat: 51.4826, lng: 0.0077 }, // Greenwich
  'NW1 8AG': { lat: 51.5413, lng: -0.1462 }, // Camden
  'SW1V 1RB': { lat: 51.4922, lng: -0.1408 }, // Victoria/Belgrave
  'N1 9AL': { lat: 51.5332, lng: -0.1061 }, // Islington
  'E1 6AN': { lat: 51.5173, lng: -0.0735 }, // Whitechapel / Spitalfields
  'M3 2AY': { lat: 53.4808, lng: -2.2426 }, // Manchester Deansgate
  'KT9 1BH': { lat: 51.3653, lng: -0.3082 }, // Operational Base / Chessington Depot
};

/**
 * Parses or estimates lat/lng for a UK postcode
 */
export function getPostcodeCoords(postcode: string): { lat: number; lng: number } {
  const clean = postcode.toUpperCase().trim();
  if (UK_POSTCODE_COORDS[clean]) {
    return UK_POSTCODE_COORDS[clean];
  }

  // Fallback estimation based on outward code prefix
  const prefix = clean.split(' ')[0];
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
 * Optimizes the route sequence starting from cleaner base using Nearest Neighbor TSP
 */
export function optimizeRoute(
  originPostcode: string,
  originAddress: string,
  jobs: CleaningJob[]
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

  const startCoords = getPostcodeCoords(originPostcode);
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
  // Format: https://www.google.com/maps/dir/Origin/Stop1/Stop2/...
  const googlePath = [
    encodeURIComponent(`${originAddress}, ${originPostcode}`),
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
