import { Client, CleaningJob } from '../types';

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
export function isClientRecurringOnDate(client: Client, targetDateStr: string): boolean {
  if (!client.active) return false;

  const targetDate = new Date(targetDateStr + 'T00:00:00');
  if (isNaN(targetDate.getTime())) return false;

  const targetDayOfWeek = targetDate.getDay();
  const preferredDay = client.preferredDayOfWeek ?? 1;

  if (targetDayOfWeek !== preferredDay) return false;

  const baseOccurrence = getFirstOccurrence(client.createdAt || '2026-01-01', preferredDay);

  // If targetDate is before base occurrence, not due yet
  if (targetDate.getTime() < baseOccurrence.getTime()) return false;

  const diffMs = targetDate.getTime() - baseOccurrence.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  switch (client.frequency) {
    case 'WEEKLY':
      return diffWeeks >= 0;
    case 'FORTNIGHTLY':
      return diffWeeks >= 0 && diffWeeks % 2 === 0;
    case 'MONTHLY':
      return diffWeeks >= 0 && diffWeeks % 4 === 0;
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

  // Get all explicit jobs for this date that are NOT deleted
  const rawJobsForDate = explicitJobs.filter(
    (j) => j.date === targetDateStr && !(j as any).isDeleted && (j.status as string) !== 'DELETED'
  );

  // Always enrich explicit jobs with official client details if client exists
  const jobsForDate = rawJobsForDate.map((j) => {
    if (j.clientId && clientMap.has(j.clientId)) {
      const client = clientMap.get(j.clientId)!;
      return {
        ...j,
        clientName: client.name || j.clientName,
        address: client.address || j.address,
        postcode: client.postcode || j.postcode,
        city: client.city || j.city,
        phone: client.phone || j.phone,
        whatsapp: client.whatsapp || j.whatsapp,
        keyDetails: client.keyDetails ?? j.keyDetails,
        alarmCode: client.alarmCode ?? j.alarmCode,
        hasPets: client.hasPets ?? j.hasPets,
        petNotes: client.petNotes ?? j.petNotes,
      };
    }
    return j;
  });

  const existingClientIds = new Set(
    explicitJobs.filter((j) => j.date === targetDateStr).map((j) => j.clientId)
  );

  const companyClients = companyId
    ? clients.filter((c) => c.companyId === companyId)
    : clients;

  const virtualJobs: CleaningJob[] = [];

  companyClients.forEach((client) => {
    if (existingClientIds.has(client.id)) return;

    if (isClientRecurringOnDate(client, targetDateStr)) {
      virtualJobs.push({
        id: `virt_${client.id}_${targetDateStr}`,
        companyId: client.companyId,
        clientId: client.id,
        clientName: client.name,
        address: client.address,
        postcode: client.postcode,
        city: client.city,
        phone: client.phone,
        whatsapp: client.whatsapp,
        cleanerId: client.preferredCleanerId || 'usr_jhonatan',
        cleanerName: client.preferredCleanerName || 'Jhonatan',
        date: targetDateStr,
        startTime: client.preferredTime || '09:00',
        estimatedDuration: client.estimatedDuration || 2.5,
        price: client.defaultPrice || 45,
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        keyDetails: client.keyDetails,
        alarmCode: client.alarmCode,
        hasPets: client.hasPets,
        petNotes: client.petNotes,
        invoiceNumber: `INV-${targetDateStr.replace(/-/g, '')}-${client.id.slice(-4)}`,
      });
    }
  });

  return [...jobsForDate, ...virtualJobs].sort((a, b) => a.startTime.localeCompare(b.startTime));
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
