import { CleaningJob, RouteOptimizationResult, JobScheduleValidation } from '../types';

// Exact audited coordinates lookup for UK client postcodes and outward codes (OS Code-Point Open)
const UK_POSTCODE_COORDS: Record<string, { lat: number; lng: number }> = {
  // 14 Registered Clients
  'KT19 0HJ': { lat: 51.364087, lng: -0.261716 }, // Cece (Epsom)
  'KT22 7NQ': { lat: 51.309673, lng: -0.328665 }, // Jenny (12 Clare Crescent, Leatherhead)
  'KT4 7RU': { lat: 51.383518, lng: -0.260951 }, // Scott (Worcester Park)
  'KT9 1JQ': { lat: 51.365007, lng: -0.295569 }, // Stephanie (Chessington)
  'KT19 0LU': { lat: 51.362703, lng: -0.252144 }, // Jasmine (Stoneleigh / Epsom)
  'KT8 2HX': { lat: 51.400129, lng: -0.361518 }, // Sophie, Cristy, Sarah, Charlotte, Helen, Piera (West Molesey)
  'KT9 2ER': { lat: 51.361638, lng: -0.304528 }, // Akon (Chessington)
  'KT7 0GE': { lat: 51.391191, lng: -0.332902 }, // Samia (Thames Ditton)
  'TW12 1NY': { lat: 51.427580, lng: -0.354868 }, // Jo (Hampton)

  // Company HQ & Bases
  'NW1 6XE': { lat: 51.5237, lng: -0.1585 }, // Baker Street HQ
  'E1 6AN': { lat: 51.5173, lng: -0.0735 }, // Commercial St (Waylla)
  'SW11 1AA': { lat: 51.4700, lng: -0.1680 }, // Battersea Park Rd
  'KT9 1BH': { lat: 51.3653, lng: -0.3082 }, // Operational Base / Chessington Depot
  'M3 2AY': { lat: 53.4808, lng: -2.2426 }, // Manchester Deansgate

  // Outward code area fallbacks
  'KT19': { lat: 51.363, lng: -0.255 },
  'KT22': { lat: 51.3096, lng: -0.3286 },
  'KT4': { lat: 51.383, lng: -0.261 },
  'KT9': { lat: 51.365, lng: -0.300 },
  'KT8': { lat: 51.400, lng: -0.361 },
  'KT7': { lat: 51.391, lng: -0.333 },
  'TW12': { lat: 51.427, lng: -0.355 },
  'SW11': { lat: 51.470, lng: -0.168 },
  'NW1': { lat: 51.530, lng: -0.150 },
  'E1': { lat: 51.517, lng: -0.070 },
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
 * Helper to get job coordinates, prioritizing real latitude/longitude first.
 */
export function getJobCoords(job: CleaningJob): { lat: number; lng: number } {
  if (job.latitude !== undefined && job.longitude !== undefined && job.latitude !== 0 && job.longitude !== 0) {
    return { lat: job.latitude, lng: job.longitude };
  }
  return getPostcodeCoords(job.postcode);
}

/**
 * Parses startTime ("09:00", "09:30", "14:00") into minutes from midnight.
 */
export function parseStartTimeMinutes(startTime?: string): number {
  if (!startTime) return 9999;
  const clean = startTime.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 9999;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (clean.includes('PM') && hours < 12) hours += 12;
  if (clean.includes('AM') && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight into "HH:mm" string (e.g. 708 -> "11:48").
 */
export function formatMinutesToHHMM(totalMinutes: number): string {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Optimizes the route sequence starting from cleaner base or live GPS coordinates.
 * Hybrid Algorithm with Schedule Validation:
 * 1. Primary priority: Scheduled Time (startTime). Earlier jobs always come before later jobs.
 * 2. Secondary priority: Minimizes estimated arrival delays and travel distance among candidates.
 * 3. Incorporates cleaning duration (estimatedDuration) to calculate travel & work windows.
 * 4. Generates precise schedule validations with delay alerts (warning / critical) for every stop.
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
      scheduleValidations: {},
      hasScheduleDelayAlert: false,
      totalDelayMinutes: 0,
    };
  }

  const startCoords = customStartCoords || getPostcodeCoords(originPostcode);
  const unvisited = [...jobs];
  const orderedJobs: CleaningJob[] = [];

  let currentCoords = startCoords;
  let currentDepartureMins = parseStartTimeMinutes(unvisited[0]?.startTime || '09:00');
  let totalDistanceMiles = 0;

  while (unvisited.length > 0) {
    // 1. Find the earliest scheduled time among unvisited jobs
    let earliestTime = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const timeMin = parseStartTimeMinutes(unvisited[i].startTime);
      if (timeMin < earliestTime) {
        earliestTime = timeMin;
      }
    }

    // 2. Find all unvisited jobs that share this earliest scheduled time
    const sameTimeCandidatesIndices: number[] = [];
    for (let i = 0; i < unvisited.length; i++) {
      const timeMin = parseStartTimeMinutes(unvisited[i].startTime);
      if (timeMin === earliestTime) {
        sameTimeCandidatesIndices.push(i);
      }
    }

    // 3. Among candidates, pick the one that minimizes arrival delay from current position, then shortest distance
    let bestCandidateIndexInUnvisited = sameTimeCandidatesIndices[0];
    let minDelay = Infinity;
    let minDistance = Infinity;

    for (const idx of sameTimeCandidatesIndices) {
      const candidateJob = unvisited[idx];
      const jobCoords = getJobCoords(candidateJob);
      const dist = calculateHaversineMiles(
        currentCoords.lat,
        currentCoords.lng,
        jobCoords.lat,
        jobCoords.lng
      );
      const travelMins = Math.round((dist / 22) * 60 + (dist > 0 ? 4 : 0));
      const estArrivalMins = currentDepartureMins + travelMins;
      const schedMins = parseStartTimeMinutes(candidateJob.startTime);
      const delay = Math.max(0, estArrivalMins - schedMins);

      if (delay < minDelay || (delay === minDelay && dist < minDistance)) {
        minDelay = delay;
        minDistance = dist;
        bestCandidateIndexInUnvisited = idx;
      }
    }

    // Extract next job
    const nextJob = unvisited.splice(bestCandidateIndexInUnvisited, 1)[0];
    orderedJobs.push(nextJob);
    totalDistanceMiles += minDistance;
    currentCoords = getJobCoords(nextJob);

    // Update currentDepartureMins for next iteration
    const schedMins = parseStartTimeMinutes(nextJob.startTime);
    const travelMins = Math.round((minDistance / 22) * 60 + (minDistance > 0 ? 4 : 0));
    const estArrivalMins = currentDepartureMins + travelMins;
    const actualStartMins = Math.max(schedMins, estArrivalMins);
    const durationMins = Math.round((nextJob.estimatedDuration || 2) * 60);
    currentDepartureMins = actualStartMins + durationMins;
  }

  // Calculate detailed schedule validations for all ordered jobs
  const scheduleValidations: Record<string, JobScheduleValidation> = {};
  let totalDelayMinutes = 0;
  let hasScheduleDelayAlert = false;

  let prevDepartureMins = 0;
  let prevCoords = startCoords;

  orderedJobs.forEach((job, index) => {
    const jobCoords = getJobCoords(job);
    const distFromPrev = calculateHaversineMiles(
      prevCoords.lat,
      prevCoords.lng,
      jobCoords.lat,
      jobCoords.lng
    );
    const travelTimeFromPrevMinutes = Math.round((distFromPrev / 22) * 60 + (distFromPrev > 0 ? 4 : 0));
    const schedMins = parseStartTimeMinutes(job.startTime);
    const schedTimeStr = job.startTime || '09:00';

    let estimatedArrivalMinutes: number;
    if (index === 0) {
      estimatedArrivalMinutes = schedMins;
    } else {
      estimatedArrivalMinutes = prevDepartureMins + travelTimeFromPrevMinutes;
    }

    const delayMinutes = Math.max(0, estimatedArrivalMinutes - schedMins);
    totalDelayMinutes += delayMinutes;

    let delayStatus: 'on_time' | 'warning' | 'critical' = 'on_time';
    if (delayMinutes > 15) {
      delayStatus = 'critical';
      hasScheduleDelayAlert = true;
    } else if (delayMinutes > 0) {
      delayStatus = 'warning';
      hasScheduleDelayAlert = true;
    }

    const estArrivalStr = formatMinutesToHHMM(estimatedArrivalMinutes);
    const actualStartMins = Math.max(schedMins, estimatedArrivalMinutes);
    const durationMins = Math.round((job.estimatedDuration || 2) * 60);
    const estDepartureMins = actualStartMins + durationMins;
    const estDepartureStr = formatMinutesToHHMM(estDepartureMins);

    let alertMessagePt = `Horário dentro do previsto (Chegada est.: ${estArrivalStr})`;
    let alertMessageEn = `On-time estimated arrival: ${estArrivalStr}`;

    if (delayStatus === 'warning') {
      alertMessagePt = `Atraso leve previsto de ${delayMinutes} min (Chegada est.: ${estArrivalStr} | Agendado: ${schedTimeStr})`;
      alertMessageEn = `Slight delay predicted: ${delayMinutes} min (Est. arrival: ${estArrivalStr} | Scheduled: ${schedTimeStr})`;
    } else if (delayStatus === 'critical') {
      alertMessagePt = `Atraso crítico previsto de ${delayMinutes} min (Chegada est.: ${estArrivalStr} | Agendado: ${schedTimeStr})`;
      alertMessageEn = `Critical delay predicted: ${delayMinutes} min (Est. arrival: ${estArrivalStr} | Scheduled: ${schedTimeStr})`;
    }

    scheduleValidations[job.id] = {
      jobId: job.id,
      travelTimeFromPrevMinutes,
      distanceFromPrevMiles: Math.round(distFromPrev * 10) / 10,
      estimatedArrivalMinutes,
      estimatedArrivalTime: estArrivalStr,
      estimatedDepartureTime: estDepartureStr,
      scheduledTimeMinutes: schedMins,
      scheduledTime: schedTimeStr,
      delayMinutes,
      delayStatus,
      alertMessagePt,
      alertMessageEn,
    };

    // Prepare state for next stop
    prevDepartureMins = estDepartureMins;
    prevCoords = jobCoords;
  });

  // Estimated driving time assuming 22 mph average urban/suburban UK driving speed + 4 min buffer per stop
  const drivingHours = totalDistanceMiles / 22;
  const totalTravelTimeMinutes = Math.round(drivingHours * 60 + orderedJobs.length * 4);

  // Build Google Maps Multi-Stop URL
  const originStr = customStartCoords
    ? `${customStartCoords.lat},${customStartCoords.lng}`
    : `${originAddress}, ${originPostcode}`;

  const googlePath = [
    encodeURIComponent(originStr),
    ...orderedJobs.map((j) => {
      if (j.latitude !== undefined && j.longitude !== undefined && j.latitude !== 0 && j.longitude !== 0) {
        return `${j.latitude},${j.longitude}`;
      }
      return encodeURIComponent(`${j.address}, ${j.postcode}`);
    }),
  ].join('/');
  const googleMapsUrl = `https://www.google.com/maps/dir/${googlePath}`;

  // Waze link for the first stop or multi-stop
  const firstStopCoords = getJobCoords(orderedJobs[0]);
  const wazeUrl = `https://waze.com/ul?ll=${firstStopCoords.lat},${firstStopCoords.lng}&navigate=yes`;

  return {
    originPostcode,
    originAddress,
    jobsInOrder: orderedJobs,
    totalDistanceMiles: Math.round(totalDistanceMiles * 10) / 10,
    totalTravelTimeMinutes,
    googleMapsUrl,
    wazeUrl,
    scheduleValidations,
    hasScheduleDelayAlert,
    totalDelayMinutes,
  };
}
