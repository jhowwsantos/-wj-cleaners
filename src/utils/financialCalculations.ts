import { CleaningJob, User, Expense, PayrollPayment } from '../types';

export interface StaffJobPayment {
  user: User;
  individualHours: number;
  hourlyRate: number;
  pay: number;
}

export interface JobFinancialDetails {
  clientRevenue: number;
  jobDuration: number;
  assignedStaff: User[];
  assignedCount: number;
  individualHours: number;
  staffPayments: StaffJobPayment[];
  totalStaffExpenses: number;
  companyBalance: number; // Saldo da Empresa = Revenue - Total Staff Expenses
}

/**
 * Finds all staff users assigned to a cleaning job based on cleanerId or cleanerName
 */
export function getAssignedStaffForJob(job: CleaningJob, users: User[]): User[] {
  if (!users || users.length === 0) return [];

  const matchedUsers: User[] = [];
  const rawIdStr = (job.cleanerId || '').trim();
  const rawNameStr = (job.cleanerName || '').trim();

  // Split IDs by comma, semicolon
  const idTokens = rawIdStr ? rawIdStr.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : [];

  // Split names by comma, semicolon, '&', or ' and '
  const nameTokens = rawNameStr
    ? rawNameStr.split(/[,;&]|\band\b/i).map((s) => s.trim()).filter(Boolean)
    : [];

  users.forEach((u) => {
    let matched = false;

    // ID matching
    if (idTokens.length > 0 && idTokens.includes(u.id)) {
      matched = true;
    } else if (rawIdStr && rawIdStr === u.id) {
      matched = true;
    }

    // Name matching
    if (!matched && nameTokens.length > 0) {
      const uNameLower = u.name.toLowerCase();
      nameTokens.forEach((token) => {
        const tokenLower = token.toLowerCase();
        if (
          tokenLower.length >= 2 &&
          (uNameLower === tokenLower || uNameLower.includes(tokenLower) || tokenLower.includes(uNameLower))
        ) {
          matched = true;
        }
      });
    } else if (!matched && rawNameStr) {
      const uNameLower = u.name.toLowerCase();
      const rawNameLower = rawNameStr.toLowerCase();
      if (rawNameLower.includes(uNameLower) || uNameLower.includes(rawNameLower)) {
        matched = true;
      }
    }

    if (matched && !matchedUsers.some((m) => m.id === u.id)) {
      matchedUsers.push(u);
    }
  });

  return matchedUsers;
}

/**
 * Calculates complete financial breakdown for a single job according to business rules:
 * 1. Client revenue never changes regardless of staff count.
 * 2. Job duration is automatically split equally among assigned staff.
 * 3. CLEANER & ADMIN get paid according to their registered hourlyRate * individualHours.
 * 4. OWNER gets 0 staff wage (Company Balance = Client Revenue - Sum of staff pay).
 */
export function calculateJobFinancials(job: CleaningJob, users: User[]): JobFinancialDetails {
  const clientRevenue = Number(job.price) || 0;
  const jobDuration = Number(job.estimatedDuration) || 0;

  const assignedStaff = getAssignedStaffForJob(job, users);
  const assignedCount = assignedStaff.length > 0 ? assignedStaff.length : 1;

  // Split hours equally among all assigned people
  const individualHours = jobDuration / assignedCount;

  let totalStaffExpenses = 0;
  const staffPayments: StaffJobPayment[] = [];

  assignedStaff.forEach((u) => {
    let hourlyRate = 0;
    let pay = 0;

    // OWNER gets 0 automatic salary. ADMIN and CLEANER receive registered hourlyRate.
    if (u.role !== 'OWNER') {
      hourlyRate = Number(u.hourlyRate) || 0;
      pay = individualHours * hourlyRate;
    }

    totalStaffExpenses += pay;
    staffPayments.push({
      user: u,
      individualHours,
      hourlyRate,
      pay,
    });
  });

  const companyBalance = clientRevenue - totalStaffExpenses;

  return {
    clientRevenue,
    jobDuration,
    assignedStaff,
    assignedCount,
    individualHours,
    staffPayments,
    totalStaffExpenses,
    companyBalance,
  };
}

/**
 * Calculates total worked hours and total staff earnings for a specific user across a collection of jobs,
 * excluding jobs already paid out via Payroll.
 */
export function calculateUserMetrics(
  user: User,
  jobs: CleaningJob[],
  users: User[],
  payrollPayments: PayrollPayment[] = []
) {
  let totalHoursWorked = 0;
  let totalEarnings = 0;
  let paidEarnings = 0;
  let jobCount = 0;
  let pendingJobCount = 0;

  const paidJobIdsForUser = new Set(
    payrollPayments.filter((p) => p.staffId === user.id).flatMap((p) => p.jobIds)
  );

  jobs.forEach((j) => {
    if (j.status === 'CANCELLED' || (j as any).isDeleted) return;

    const assigned = getAssignedStaffForJob(j, users);
    const isAssigned = assigned.some((u) => u.id === user.id);

    if (isAssigned) {
      jobCount++;
      const count = assigned.length > 0 ? assigned.length : 1;
      const hours = (j.estimatedDuration || 0) / count;
      totalHoursWorked += hours;

      if (user.role !== 'OWNER') {
        const rate = Number(user.hourlyRate) || 0;
        const jobPay = hours * rate;

        if (paidJobIdsForUser.has(j.id)) {
          paidEarnings += jobPay;
        } else {
          totalEarnings += jobPay;
          pendingJobCount++;
        }
      }
    }
  });

  return {
    totalHoursWorked,
    totalEarnings, // Unpaid earnings ("A Receber")
    paidEarnings,
    jobCount,
    pendingJobCount,
  };
}

export interface StaffPayrollSummary {
  user: User;
  assignedCompletedJobs: CleaningJob[];
  pendingJobs: CleaningJob[];
  paidJobs: CleaningJob[];
  totalHours: number;
  pendingHours: number;
  paidHours: number;
  hourlyRate: number;
  totalEarnings: number;
  pendingAmount: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'N/A';
}

/**
 * Calculates comprehensive payroll metrics for a specific staff user in a date range
 */
export function calculateStaffPayrollSummary(
  user: User,
  jobs: CleaningJob[],
  users: User[],
  payrollPayments: PayrollPayment[] = [],
  startDate?: string,
  endDate?: string
): StaffPayrollSummary {
  const paidJobIdsForUser = new Set(
    payrollPayments.filter((p) => p.staffId === user.id).flatMap((p) => p.jobIds)
  );

  const assignedCompletedJobs = jobs.filter((j) => {
    if (j.status !== 'COMPLETED' || (j as any).isDeleted) return false;

    if (startDate && j.date < startDate) return false;
    if (endDate && j.date > endDate) return false;

    const assigned = getAssignedStaffForJob(j, users);
    return assigned.some((u) => u.id === user.id);
  });

  const pendingJobs: CleaningJob[] = [];
  const paidJobs: CleaningJob[] = [];

  let totalHours = 0;
  let pendingHours = 0;
  let paidHours = 0;

  assignedCompletedJobs.forEach((j) => {
    const assigned = getAssignedStaffForJob(j, users);
    const count = assigned.length > 0 ? assigned.length : 1;
    const hours = (j.estimatedDuration || 0) / count;
    totalHours += hours;

    if (paidJobIdsForUser.has(j.id)) {
      paidJobs.push(j);
      paidHours += hours;
    } else {
      pendingJobs.push(j);
      pendingHours += hours;
    }
  });

  const hourlyRate = user.role === 'OWNER' ? 0 : Number(user.hourlyRate) || 0;
  const totalEarnings = totalHours * hourlyRate;
  const pendingAmount = pendingHours * hourlyRate;
  const paidAmount = paidHours * hourlyRate;

  let status: 'PENDING' | 'PAID' | 'N/A' = 'PENDING';
  if (user.role === 'OWNER') {
    status = 'N/A';
  } else if (pendingJobs.length === 0) {
    status = 'PAID';
  } else {
    status = 'PENDING';
  }

  return {
    user,
    assignedCompletedJobs,
    pendingJobs,
    paidJobs,
    totalHours,
    pendingHours,
    paidHours,
    hourlyRate,
    totalEarnings,
    pendingAmount,
    paidAmount,
    status,
  };
}

/**
 * Calculates total financial summary for a set of jobs and expenses
 */
export function calculateCompanyFinancials(jobs: CleaningJob[], expenses: Expense[], users: User[]) {
  let totalRevenue = 0;
  let totalStaffWages = 0;
  let totalJobCompanyBalance = 0;

  jobs.forEach((j) => {
    if (j.status === 'CANCELLED' || (j as any).isDeleted) return;

    const fin = calculateJobFinancials(j, users);
    totalRevenue += fin.clientRevenue;
    totalStaffWages += fin.totalStaffExpenses;
    totalJobCompanyBalance += fin.companyBalance;
  });

  const totalOperatingExpenses = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const netCompanyProfit = totalRevenue - totalStaffWages - totalOperatingExpenses;

  return {
    totalRevenue,
    totalStaffWages,
    totalOperatingExpenses,
    totalExpenses: totalStaffWages + totalOperatingExpenses,
    netCompanyProfit,
  };
}
