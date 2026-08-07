import { CleaningJob, Client, Expense, Company, User } from '../types';
import logoImg from '../assets/logo.png';
import { calculateJobFinancials } from './financialCalculations';

/**
 * Downloads a structured CSV file
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports Financial Revenue & Expenses to CSV/Excel
 */
export function exportFinancialsCSV(company: Company, jobs: CleaningJob[], expenses: Expense[], users?: User[]) {
  const headers = [
    'Type',
    'Date',
    'Description / Client',
    'Category / Service',
    'Client Revenue (£)',
    'Staff Cost (£)',
    'Company Profit (£)',
    'Status',
  ];
  const rows: (string | number)[][] = [];

  jobs.forEach((j) => {
    const fin = users ? calculateJobFinancials(j, users) : { totalStaffExpenses: 0, companyBalance: j.price };
    rows.push([
      'REVENUE',
      j.date,
      j.clientName,
      `Cleaning (${j.estimatedDuration} hrs)`,
      j.price,
      fin.totalStaffExpenses,
      fin.companyBalance,
      j.paymentStatus,
    ]);
  });

  expenses.forEach((e) => {
    rows.push(['EXPENSE', e.date, e.description, e.category, 0, e.amount, -e.amount, 'PAID']);
  });

  downloadCSV(`${company.code}_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
}

/**
 * Exports Client CRM directory to CSV
 */
export function exportClientsCSV(company: Company, clients: Client[]) {
  const headers = [
    'Client Name',
    'Address',
    'Postcode',
    'City',
    'Phone',
    'Email',
    'Price (£)',
    'Duration (hrs)',
    'Frequency',
    'Holds Key',
    'Alarm Code',
    'Pets',
  ];

  const rows = clients.map((c) => [
    c.name,
    c.address,
    c.postcode,
    c.city,
    c.phone,
    c.email,
    c.defaultPrice,
    c.estimatedDuration,
    c.frequency,
    c.hasKey ? 'YES' : 'NO',
    c.alarmCode || 'N/A',
    c.hasPets ? 'YES' : 'NO',
  ]);

  downloadCSV(`${company.code}_Clients_List_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
}

/**
 * Exports Scheduled & Completed Cleaning Jobs to CSV
 */
export function exportJobsCSV(company: Company, jobs: CleaningJob[]) {
  const headers = [
    'Job ID',
    'Date',
    'Time',
    'Client Name',
    'Address',
    'Postcode',
    'Cleaner',
    'Price (£)',
    'Duration (hrs)',
    'Status',
    'Payment Status',
    'Invoice Number',
  ];

  const rows = jobs.map((j) => [
    j.id,
    j.date,
    j.startTime,
    j.clientName,
    j.address,
    j.postcode,
    j.cleanerName || 'Unassigned',
    j.price,
    j.estimatedDuration,
    j.status,
    j.paymentStatus,
    j.invoiceNumber || '',
  ]);

  downloadCSV(`${company.code}_Jobs_Export_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
}

/**
 * Triggers browser print layout for a generated receipt or report
 */
export function printReceipt(job: CleaningJob, company: Company) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${job.invoiceNumber || job.id} - ${company.name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 600px; margin: 0 auto; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; }
          .logo { font-size: 24px; font-weight: bold; color: #1e40af; }
          .invoice-title { font-size: 20px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
          .company-info { font-size: 13px; color: #475569; line-height: 1.5; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
          .section-title { font-weight: bold; color: #0f172a; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f1f5f9; text-align: left; padding: 12px; font-size: 13px; color: #475569; border-bottom: 1px solid #cbd5e1; }
          td { padding: 12px; font-size: 14px; border-bottom: 1px solid #e2e8f0; }
          .total-box { background: #eff6ff; padding: 16px; border-radius: 8px; text-align: right; font-size: 18px; font-weight: bold; color: #1e40af; }
          .signature-box { margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; font-size: 13px; color: #64748b; }
          .signature-img { max-height: 60px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            ${
              company.id === 'comp_wj_london' || (company.logoUrl && company.logoUrl !== '/logo.png')
                ? `<img src="${company.logoUrl || '/logo.png'}" style="height: 54px; width: auto; margin-bottom: 8px; object-fit: contain;" alt="${company.name}" />`
                : `<div style="display: inline-block; background-color: ${company.primaryColor || '#1e3a8a'}; color: #ffffff; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-size: 18px; margin-bottom: 8px;">${company.code || company.name.slice(0, 2).toUpperCase()}</div>`
            }
            <div class="logo">${company.name}</div>
            <div class="company-info">
              ${company.address}, ${company.postcode}<br/>
              Phone: ${company.phone} | Email: ${company.email}<br/>
              ${company.vatNumber ? `VAT Reg: ${company.vatNumber}` : ''}
            </div>
          </div>
          <div style="text-align: right;">
            <div class="invoice-title">Cleaning Receipt</div>
            <div style="font-weight: bold; color: #0f172a;">${job.invoiceNumber || 'INV-' + job.id.slice(0, 8)}</div>
            <div style="font-size: 13px; color: #64748b;">Date: ${job.date}</div>
          </div>
        </div>

        <div class="details-grid">
          <div>
            <div class="section-title">Client Details:</div>
            <div>${job.clientName}</div>
            <div>${job.address}</div>
            <div>${job.postcode}, ${job.city}</div>
            <div>Phone: ${job.phone}</div>
          </div>
          <div>
            <div class="section-title">Service Details:</div>
            <div>Cleaner: ${job.cleanerName || 'W & J Cleaners Team'}</div>
            <div>Time: ${job.startTime} (${job.estimatedDuration} hrs)</div>
            <div>Status: <strong>COMPLETED & PAID</strong></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Hours</th>
              <th style="text-align: right;">Amount (£)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Professional Residential/Commercial Cleaning Service</td>
              <td>${job.estimatedDuration} hrs</td>
              <td style="text-align: right;">£${job.price.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-box">
          Total Paid: £${job.price.toFixed(2)}
        </div>

        ${
          job.clientSignature
            ? `<div class="signature-box">
                <div>Client Confirmation Signature:</div>
                <img src="${job.clientSignature}" class="signature-img" />
              </div>`
            : ''
        }

        <div class="footer">
          Thank you for choosing ${company.name}! For queries, please contact ${company.email}.
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

/**
 * Exports Payroll details to CSV
 */
export function exportPayrollCSV(
  company: Company,
  payrollSummaries: any[],
  historyPayments: any[],
  periodLabel: string
) {
  const headers = [
    'Staff Name',
    'Role',
    'Worked Hours (hrs)',
    'Hourly Rate (£/h)',
    'Pending Amount (£)',
    'Paid Amount (£)',
    'Status',
    'Period',
  ];

  const rows: (string | number)[][] = [];

  payrollSummaries.forEach((s) => {
    rows.push([
      s.user.name,
      s.user.role,
      Number(s.totalHours.toFixed(1)),
      s.hourlyRate,
      s.pendingAmount.toFixed(2),
      s.paidAmount.toFixed(2),
      s.status === 'PAID' ? 'PAID' : s.status === 'PENDING' ? 'PENDING' : 'N/A',
      periodLabel,
    ]);
  });

  if (historyPayments.length > 0) {
    rows.push([]);
    rows.push(['PAYMENT HISTORY RECORD']);
    rows.push(['Staff Name', 'Period', 'Amount Paid (£)', 'Hours Paid (hrs)', 'Payment Method', 'Paid At', 'Paid By']);
    historyPayments.forEach((hp) => {
      rows.push([
        hp.staffName,
        hp.periodLabel,
        hp.amount.toFixed(2),
        hp.hours.toFixed(1),
        hp.paymentMethod,
        new Date(hp.paidAt).toLocaleString(),
        hp.paidBy,
      ]);
    });
  }

  downloadCSV(
    `${company.code}_Payroll_${new Date().toISOString().split('T')[0]}.csv`,
    headers,
    rows
  );
}
