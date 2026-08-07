import { Client, CleaningJob } from '../types';

function getIsoWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return d.toISOString().split('T')[0];
}

/**
 * Helper to get the first date matching preferredDayOfWeek on or after baseDate
 */
function getFirstOccurrence(createdAtStr: string, preferredDayOfWeek: number): Date {
  const base = new Date(createdAtStr + 'T00:00:00');
  if (isNaN(base.getTime())) {
    const fallback = new Date('2026-01-01T00:00:00');
    return getFirstOccurrence('2026-01-01', preferredDayOfWeek);
  }
  const currentDay = base.getDay();
  let diff = preferredDayOfWeek - currentDay;
  if (diff < 0) diff += 7;
  base.setDate(base.getDate() + diff);
  return base;
}

/**
 * Returns true if targetDate string (YYYY-MM-DD) matches client's recurring frequency rule
 */
export function isClientRecurringOnDate(
  client: Client,
  targetDateStr: string,
  explicitJobs?: CleaningJob[]
): boolean {
  if (!client.active) return false;

  const targetDate = new Date(targetDateStr + 'T00:00:00');
  if (isNaN(targetDate.getTime())) return false;

  // Do not generate recurring jobs after client's end date (if defined)
  if (client.customEndDate && targetDateStr > client.customEndDate) {
    return false;
  }

  if (client.frequency === 'CUSTOM_DAYS') {
    const customDays = client.customIntervalDays && client.customIntervalDays > 0 ? client.customIntervalDays : 20;
    let baseDateStr = client.customStartDate;

    if (explicitJobs && explicitJobs.length > 0) {
      const clientJobs = explicitJobs.filter(
        (j) => j.clientId === client.id && !(j as any).isDeleted && (j.status as string) !== 'DELETED'
      );
      if (clientJobs.length > 0) {
        const sortedDates = clientJobs.map((j) => j.date).sort();
        baseDateStr = sortedDates[0];
      }
    }

    if (!baseDateStr) {
      baseDateStr = client.createdAt ? client.createdAt.split('T')[0] : '2026-01-01';
    }

    if (baseDateStr && targetDateStr < baseDateStr) {
      return false;
    }

    let baseDate = new Date(baseDateStr + 'T00:00:00');
    if (isNaN(baseDate.getTime())) {
      baseDate = new Date('2026-01-01T00:00:00');
    }

    const diffMs = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    return Math.abs(diffDays) % customDays === 0;
  }

  const targetDayOfWeek = targetDate.getDay();
  const preferredDay = client.preferredDayOfWeek ?? 1;

  if (targetDayOfWeek !== preferredDay) return false;

  // Determine the base reference date anchor for start bounds and cycle calculation
  let baseDateStr = client.customStartDate;

  // Check explicitJobs for the earliest explicit job date to anchor baseDateStr
  if (explicitJobs && explicitJobs.length > 0) {
    const clientJobs = explicitJobs.filter(
      (j) => j.clientId === client.id && !(j as any).isDeleted && (j.status as string) !== 'DELETED'
    );
    if (clientJobs.length > 0) {
      const datesOnPreferredDay = clientJobs
        .filter((j) => new Date(j.date + 'T00:00:00').getDay() === preferredDay)
        .map((j) => j.date)
        .sort();
      const earliestJobDate = datesOnPreferredDay[0] || clientJobs.map((j) => j.date).sort()[0];
      if (earliestJobDate && (!baseDateStr || earliestJobDate < baseDateStr)) {
        baseDateStr = earliestJobDate;
      }
    }
  }

  const createdDate = client.createdAt ? client.createdAt.split('T')[0] : '2026-01-01';
  if (!baseDateStr || createdDate < baseDateStr) {
    baseDateStr = createdDate;
  }

  // Do not generate recurring jobs for dates strictly before client's start date
  if (baseDateStr && targetDateStr < baseDateStr) {
    return false;
  }

  const clientFreq = client.frequency || 'WEEKLY';

  if (clientFreq === 'WEEKLY') {
    return true;
  }

  const baseOccurrence = getFirstOccurrence(baseDateStr, preferredDay);

  const diffMs = targetDate.getTime() - baseOccurrence.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (diffWeeks < 0) return false;

  switch (clientFreq) {
    case 'FORTNIGHTLY':
      return diffWeeks % 2 === 0;
    case 'MONTHLY':
      return diffWeeks % 4 === 0;
    case 'ONE_OFF':
      return diffWeeks === 0;
    default:
      return false;
  }
}

/**
 * Generates virtual jobs for clients for target date if no explicit job exists
 */
export function getCombinedJobsForDate(
  explicitJobs: CleaningJob[],
  clients: Client[],
  targetDateStr: string,
  companyId?: string
): CleaningJob[] {
  const clientMap = new Map<string, Client>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const todayStr = new Date().toISOString().split('T')[0];
  const isPastDate = targetDateStr < todayStr;

  // Check if a global schedule clear tombstone exists
  const globalClearDoc = explicitJobs.find((j) => j.id === 'global_schedule_clear' || (j as any).isCleared);
  const globalClearCreatedAt = globalClearDoc ? ((globalClearDoc as any).createdAt || '2099-12-31') : null;

  // Get all explicit jobs for this date that are NOT deleted and match client's registered day (unless manually rescheduled)
  const rawJobsForDate = explicitJobs.filter((j) => {
    if (j.id === 'global_schedule_clear' || (j as any).isCleared) return false;
    if (
      j.date !== targetDateStr ||
      (j as any).isDeleted ||
      (j.status as string) === 'DELETED' ||
      (j.status as string) === 'CANCELLED'
    ) {
      return false;
    }

    if (globalClearCreatedAt && j.createdAt && j.createdAt < globalClearCreatedAt) {
      return false;
    }

    if (j.clientId && clientMap.has(j.clientId)) {
      const client = clientMap.get(j.clientId)!;
      if (
        client.active &&
        client.frequency !== 'CUSTOM_DAYS' &&
        client.preferredDayOfWeek !== undefined &&
        client.preferredDayOfWeek !== null
      ) {
        const jobDayOfWeek = new Date(j.date + 'T00:00:00').getDay();
        // If job falls on a day different from client's preferred day and was not manually rescheduled, exclude it
        if (jobDayOfWeek !== client.preferredDayOfWeek && !j.isRescheduled) {
          return false;
        }
      }
    }

    return true;
  });

  // Always enrich explicit jobs with official client details if client exists
  // For any job on a past date, ensure status is 'COMPLETED'
  const jobsForDate = rawJobsForDate.map((j) => {
    let enriched = { ...j };
    if (j.clientId && clientMap.has(j.clientId)) {
      const client = clientMap.get(j.clientId)!;
      enriched = {
        ...j,
        clientName: client.name || j.clientName,
        address: client.address || j.address,
        postcode: client.postcode || j.postcode,
        city: client.city || j.city,
        latitude: client.latitude ?? j.latitude,
        longitude: client.longitude ?? j.longitude,
        phone: client.phone || j.phone,
        whatsapp: client.whatsapp || j.whatsapp,
        keyDetails: client.keyDetails ?? j.keyDetails,
        alarmCode: client.alarmCode ?? j.alarmCode,
        hasPets: client.hasPets ?? j.hasPets,
        petNotes: client.petNotes ?? j.petNotes,
      };
    }
    if (isPastDate) {
      enriched.status = 'COMPLETED';
    }
    return enriched;
  });

  const existingClientIds = new Set(
    explicitJobs
      .filter((j) => j.date === targetDateStr || j.id === `del_${j.clientId}_${targetDateStr}`)
      .map((j) => j.clientId)
  );

  const companyClients = companyId
    ? clients.filter((c) => c.companyId === companyId)
    : clients;

  const virtualJobs: CleaningJob[] = [];

  const targetWeekStart = getIsoWeekStart(targetDateStr);

  companyClients.forEach((client) => {
    if (existingClientIds.has(client.id)) return;

    // Prevent duplicate virtual job if client already has an explicit job in this week/cycle (e.g. moved from Sunday to Monday)
    const hasExplicitJobInCycle = explicitJobs.some((j) => {
      if (
        j.clientId !== client.id ||
        (j as any).isDeleted ||
        (j.status as string) === 'DELETED' ||
        (j.status as string) === 'CANCELLED'
      ) {
        return false;
      }

      // Ignore explicit jobs that are on a different day of week if not rescheduled
      if (
        client.frequency !== 'CUSTOM_DAYS' &&
        client.preferredDayOfWeek !== undefined &&
        client.preferredDayOfWeek !== null
      ) {
        const jobDayOfWeek = new Date(j.date + 'T00:00:00').getDay();
        if (jobDayOfWeek !== client.preferredDayOfWeek && !j.isRescheduled) {
          return false;
        }
      }

      const clientFreq = client.frequency || 'WEEKLY';
      if (clientFreq === 'WEEKLY') {
        return getIsoWeekStart(j.date) === targetWeekStart;
      }
      const diffMs = Math.abs(new Date(j.date + 'T00:00:00').getTime() - new Date(targetDateStr + 'T00:00:00').getTime());
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      return diffDays <= 5;
    });

    if (hasExplicitJobInCycle) return;

    if (isClientRecurringOnDate(client, targetDateStr, explicitJobs)) {
      virtualJobs.push({
        id: `virt_${client.id}_${targetDateStr}`,
        companyId: client.companyId,
        clientId: client.id,
        clientName: client.name,
        address: client.address,
        postcode: client.postcode,
        city: client.city,
        latitude: client.latitude,
        longitude: client.longitude,
        phone: client.phone,
        whatsapp: client.whatsapp,
        cleanerId: client.preferredCleanerId || 'usr_waylla',
        cleanerName: client.preferredCleanerName || 'Waylla',
        date: targetDateStr,
        startTime: client.preferredTime || '09:00',
        estimatedDuration: client.estimatedDuration || 2.5,
        price: client.defaultPrice || 45,
        status: isPastDate ? 'COMPLETED' : 'SCHEDULED',
        paymentStatus: 'PENDING',
        keyDetails: client.keyDetails,
        alarmCode: client.alarmCode,
        hasPets: client.hasPets,
        petNotes: client.petNotes,
        customIntervalDays: client.customIntervalDays,
        customStartDate: client.customStartDate,
        customEndDate: client.customEndDate,
        invoiceNumber: `INV-${targetDateStr.replace(/-/g, '')}-${client.id.slice(-4)}`,
      });
    }
  });

  const combined = [...jobsForDate, ...virtualJobs];

  return combined.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/**
 * Computes a map of date -> jobs array for an entire month YYYY-MM
 */
export function getCombinedJobsForMonth(
  explicitJobs: CleaningJob[],
  clients: Client[],
  year: number,
  month: number, // 0-indexed month (0 = Jan, 11 = Dec)
  companyId?: string
): Record<string, CleaningJob[]> {
  const result: Record<string, CleaningJob[]> = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const jobsOnDay = getCombinedJobsForDate(explicitJobs, clients, dateStr, companyId);
    if (jobsOnDay.length > 0) {
      result[dateStr] = jobsOnDay;
    }
  }

  return result;
}
