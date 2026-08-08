import { Client, CleaningJob } from '../types';

function getIsoWeekStart(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(utcDate.getTime())) return dateStr;
  const day = utcDate.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  utcDate.setUTCDate(utcDate.getUTCDate() + diffToMon);
  return utcDate.toISOString().split('T')[0];
}

/**
 * Helper to get the first date matching preferredDayOfWeek on or after baseDate
 */
function getFirstOccurrence(createdAtStr: string, preferredDayOfWeek: number): Date {
  const [y, m, d] = createdAtStr.split('-').map(Number);
  const base = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1));
  const currentDay = base.getUTCDay();
  let diff = preferredDayOfWeek - currentDay;
  if (diff < 0) diff += 7;
  base.setUTCDate(base.getUTCDate() + diff);
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
  if (client.active === false) return false;

  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(tY, tM - 1, tD));
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
        if (!baseDateStr || sortedDates[0] < baseDateStr) {
          baseDateStr = sortedDates[0];
        }
      }
    }

    if (!baseDateStr) {
      baseDateStr = client.createdAt ? client.createdAt.split('T')[0] : '2026-01-01';
    }

    if (baseDateStr && targetDateStr < baseDateStr) {
      return false;
    }

    const [bY, bM, bD] = baseDateStr.split('-').map(Number);
    const baseDate = new Date(Date.UTC(bY, bM - 1, bD));

    const diffMs = targetDate.getTime() - baseDate.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

    return Math.abs(diffDays) % customDays === 0;
  }

  const targetDayOfWeek = targetDate.getUTCDay();
  const preferredDay = client.preferredDayOfWeek ?? 1;

  if (targetDayOfWeek !== preferredDay) return false;

  // Determine the base reference date anchor for start bounds and cycle calculation
  let baseDateStr = client.customStartDate;

  // Check explicitJobs for the earliest explicit job date to anchor baseDateStr if customStartDate is not defined
  if (explicitJobs && explicitJobs.length > 0) {
    const clientJobs = explicitJobs.filter(
      (j) => j.clientId === client.id && !(j as any).isDeleted && (j.status as string) !== 'DELETED'
    );
    if (clientJobs.length > 0) {
      const datesOnPreferredDay = clientJobs
        .filter((j) => {
          const [jY, jM, jD] = j.date.split('-').map(Number);
          return new Date(Date.UTC(jY, jM - 1, jD)).getUTCDay() === preferredDay;
        })
        .map((j) => j.date)
        .sort();
      const earliestJobDate = datesOnPreferredDay[0] || clientJobs.map((j) => j.date).sort()[0];
      if (!baseDateStr || (earliestJobDate && earliestJobDate < baseDateStr)) {
        baseDateStr = earliestJobDate;
      }
    }
  }

  if (!baseDateStr) {
    baseDateStr = client.createdAt ? client.createdAt.split('T')[0] : '2026-01-01';
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
        const [jY, jM, jD] = j.date.split('-').map(Number);
        const jobDayOfWeek = new Date(Date.UTC(jY, jM - 1, jD)).getUTCDay();
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
  const enrichedJobsForDate = rawJobsForDate.map((j) => {
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

  // Deduplicate explicit jobs on targetDateStr by client + startTime to prevent double entries
  const uniqueJobsMap = new Map<string, CleaningJob>();
  enrichedJobsForDate.forEach((j) => {
    const clientKey = j.clientId || (j.clientName ? j.clientName.trim().toLowerCase() : 'unknown');
    const timeKey = j.startTime || '09:00';
    const key = `${clientKey}___${timeKey}`;

    if (!uniqueJobsMap.has(key)) {
      uniqueJobsMap.set(key, j);
    } else {
      const existing = uniqueJobsMap.get(key)!;
      // Prefer job with completed/in-progress status or photos/signatures over a scheduled placeholder
      const isBetter =
        (j.status === 'COMPLETED' || j.status === 'IN_PROGRESS') &&
        existing.status !== 'COMPLETED' &&
        existing.status !== 'IN_PROGRESS';
      if (isBetter) {
        uniqueJobsMap.set(key, j);
      }
    }
  });

  const jobsForDate = Array.from(uniqueJobsMap.values());

  const existingClientIds = new Set(
    explicitJobs
      .filter((j) => j.date === targetDateStr || j.id === `del_${j.clientId}_${targetDateStr}`)
      .map((j) => j.clientId)
      .filter(Boolean)
  );

  const existingClientNames = new Set(
    explicitJobs
      .filter((j) => j.date === targetDateStr || j.id.includes(targetDateStr))
      .map((j) => (j.clientName || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const companyClients = companyId
    ? clients.filter((c) => c.companyId === companyId)
    : clients;

  const virtualJobs: CleaningJob[] = [];

  const targetWeekStart = getIsoWeekStart(targetDateStr);

  companyClients.forEach((client) => {
    if (
      existingClientIds.has(client.id) ||
      existingClientNames.has((client.name || '').trim().toLowerCase())
    ) {
      return;
    }

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
        const [jY, jM, jD] = j.date.split('-').map(Number);
        const jobDayOfWeek = new Date(Date.UTC(jY, jM - 1, jD)).getUTCDay();
        if (jobDayOfWeek !== client.preferredDayOfWeek && !j.isRescheduled) {
          return false;
        }
      }

      const clientFreq = client.frequency || 'WEEKLY';
      if (clientFreq === 'WEEKLY') {
        return getIsoWeekStart(j.date) === targetWeekStart;
      }
      const [jY, jM, jD] = j.date.split('-').map(Number);
      const [tY, tM, tD] = targetDateStr.split('-').map(Number);
      const diffMs = Math.abs(new Date(Date.UTC(jY, jM - 1, jD)).getTime() - new Date(Date.UTC(tY, tM - 1, tD)).getTime());
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

  // Audit console logging as requested showing recurring projection metrics
  const activeCompanyClients = companyId ? clients.filter(c => c.companyId === companyId) : clients;
  activeCompanyClients.forEach((c) => {
    if (c.active !== false) {
      const generatedDates: string[] = [];
      Object.entries(result).forEach(([dateStr, jobsOnDay]) => {
        if (jobsOnDay.some((j) => j.clientId === c.id)) {
          generatedDates.push(dateStr);
        }
      });
      if (generatedDates.length > 0) {
        console.log('[Schedule Generator Audit - Client Analysis]:', {
          clienteAnalisado: c.name,
          frequencia: c.frequency || 'WEEKLY',
          dataInicial: c.customStartDate || c.createdAt || 'N/A',
          diaDaSemana: c.preferredDayOfWeek ?? 1,
          quantidadeOcorrenciasGeradas: generatedDates.length,
          datasGeradas: generatedDates,
        });
      }
    }
  });

  return result;
}
