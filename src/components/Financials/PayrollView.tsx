import React, { useState, useMemo } from 'react';
import {
  Users,
  PoundSterling,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Download,
  Search,
  Filter,
  ChevronRight,
  CreditCard,
  Wallet,
  X,
  FileText,
  Check,
  History,
  Building2,
  Shield,
  User as UserIcon,
  Trash2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, CleaningJob, PaymentMethod, PayrollPayment } from '../../types';
import { calculateStaffPayrollSummary, StaffPayrollSummary } from '../../utils/financialCalculations';
import { exportPayrollCSV } from '../../utils/exportUtils';
import { getTranslation } from '../../utils/i18n';

type PeriodPreset = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const PayrollView: React.FC = () => {
  const {
    users,
    jobs,
    payrollPayments,
    addPayrollPayment,
    deletePayrollPayment,
    clearStaffPayrollPayments,
    currentCompany,
    currentUser,
    language,
  } = useApp();

  // Sub-tabs
  const [payrollTab, setPayrollTab] = useState<'current' | 'history'>('current');

  // Period Filter State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('MONTH');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute preset date ranges
  const dateRange = useMemo(() => {
    const now = new Date();
    if (periodPreset === 'TODAY') {
      return { start: todayStr, end: todayStr, label: language === 'pt' ? 'Hoje' : 'Today' };
    }
    if (periodPreset === 'WEEK') {
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const start = monday.toISOString().split('T')[0];
      const end = sunday.toISOString().split('T')[0];
      return {
        start,
        end,
        label: language === 'pt' ? `Semana (${start.split('-').reverse().join('/')} - ${end.split('-').reverse().join('/')})` : `Week (${start} to ${end})`,
      };
    }
    if (periodPreset === 'MONTH') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
      const start = `${year}-${month}-01`;
      const end = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      const monthNamesPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthLabel = language === 'pt' ? monthNamesPt[now.getMonth()] : monthNamesEn[now.getMonth()];
      return {
        start,
        end,
        label: `${monthLabel} ${year}`,
      };
    }
    return { start: '', end: '', label: language === 'pt' ? 'Período Personalizado' : 'Custom Period' };
  }, [periodPreset, todayStr, language]);

  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const activeStartDate = periodPreset === 'CUSTOM' ? customStartDate : dateRange.start;
  const activeEndDate = periodPreset === 'CUSTOM' ? customEndDate : dateRange.end;

  const activePeriodLabel = useMemo(() => {
    if (periodPreset === 'CUSTOM') {
      return `${customStartDate.split('-').reverse().join('/')} até ${customEndDate.split('-').reverse().join('/')}`;
    }
    return dateRange.label;
  }, [periodPreset, customStartDate, customEndDate, dateRange.label]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');

  // Selected Staff for Detail Drawer/Modal
  const [selectedStaffSummary, setSelectedStaffSummary] = useState<StaffPayrollSummary | null>(null);

  // Payment Confirmation Modal State
  const [paymentModalStaff, setPaymentModalStaff] = useState<StaffPayrollSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Custom React Deletion Confirmation States
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<PayrollPayment | null>(null);
  const [clearHistoryStaffId, setClearHistoryStaffId] = useState<string | null>(null);

  // Calculate Payroll Summaries for all staff
  const staffSummaries = useMemo(() => {
    return users
      .filter((u) => u.active !== false)
      .map((u) =>
        calculateStaffPayrollSummary(
          u,
          jobs,
          users,
          payrollPayments,
          activeStartDate || undefined,
          activeEndDate || undefined
        )
      );
  }, [users, jobs, payrollPayments, activeStartDate, activeEndDate]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    let totalPayrollPending = 0;
    let totalPayrollPaid = 0;
    let totalHours = 0;
    let pendingStaffCount = 0;
    let paidStaffCount = 0;

    staffSummaries.forEach((s) => {
      totalHours += s.totalHours;
      if (s.user.role !== 'OWNER') {
        totalPayrollPending += s.pendingAmount;
        totalPayrollPaid += s.paidAmount;
        if (s.pendingAmount > 0) {
          pendingStaffCount++;
        } else if (s.assignedCompletedJobs.length > 0 || s.paidJobs.length > 0) {
          paidStaffCount++;
        }
      }
    });

    return {
      totalPayrollPending,
      totalPayrollPaid,
      totalHours,
      pendingStaffCount,
      paidStaffCount,
    };
  }, [staffSummaries]);

  // Filtered staff summaries for current tab
  const filteredSummaries = useMemo(() => {
    return staffSummaries.filter((s) => {
      const matchesSearch =
        s.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.user.role.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'PENDING') return s.pendingAmount > 0;
      if (statusFilter === 'PAID') return s.status === 'PAID' && s.user.role !== 'OWNER';

      return true;
    });
  }, [staffSummaries, searchTerm, statusFilter]);

  // Filtered payment history
  const filteredHistory = useMemo(() => {
    return payrollPayments.filter((p) => {
      if (!searchTerm) return true;
      return (
        p.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.periodLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [payrollPayments, searchTerm]);

  // Confirm payment handler
  const handleConfirmPayment = () => {
    if (!paymentModalStaff) return;

    const pendingJobsToPay = paymentModalStaff.pendingJobs;
    if (pendingJobsToPay.length === 0) return;

    addPayrollPayment({
      staffId: paymentModalStaff.user.id,
      staffName: paymentModalStaff.user.name,
      periodLabel: activePeriodLabel,
      startDate: activeStartDate,
      endDate: activeEndDate,
      amount: paymentModalStaff.pendingAmount,
      hours: paymentModalStaff.pendingHours,
      jobIds: pendingJobsToPay.map((j) => j.id),
      paymentMethod,
      paidBy: currentUser?.name || 'Owner',
      notes: paymentNotes.trim() || undefined,
    });

    setPaymentModalStaff(null);
    setSelectedStaffSummary(null);
    setPaymentNotes('');
  };

  // Export CSV handler
  const handleExportCSV = () => {
    exportPayrollCSV(currentCompany, staffSummaries, payrollPayments, activePeriodLabel);
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Main Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {language === 'pt' ? 'Folha de Pagamento' : 'Payroll Management'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'pt'
              ? 'Gestão de valores a receber e pagamentos aos colaboradores da empresa'
              : 'Manage employee compensation, pending payouts, and payment history'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-medium text-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            {language === 'pt' ? 'Exportar Folha' : 'Export Payroll'}
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Module Sub-Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 self-start">
          <button
            onClick={() => setPayrollTab('current')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              payrollTab === 'current'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            {language === 'pt' ? 'Pendentes & Pagos' : 'Current Payouts'}
          </button>
          <button
            onClick={() => setPayrollTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              payrollTab === 'history'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            {language === 'pt' ? 'Histórico de Pagamentos' : 'Payment History'}
            {payrollPayments.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                {payrollPayments.length}
              </span>
            )}
          </button>
        </div>

        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <button
            onClick={() => setPeriodPreset('TODAY')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              periodPreset === 'TODAY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {language === 'pt' ? 'Hoje' : 'Today'}
          </button>
          <button
            onClick={() => setPeriodPreset('WEEK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              periodPreset === 'WEEK'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {language === 'pt' ? 'Esta Semana' : 'This Week'}
          </button>
          <button
            onClick={() => setPeriodPreset('MONTH')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              periodPreset === 'MONTH'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {language === 'pt' ? 'Este Mês' : 'This Month'}
          </button>
          <button
            onClick={() => setPeriodPreset('CUSTOM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
              periodPreset === 'CUSTOM'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {language === 'pt' ? 'Personalizado' : 'Custom'}
          </button>

          {periodPreset === 'CUSTOM' && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200"
              />
              <span className="text-xs text-slate-400">até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Payroll Summary Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pending Payroll Card */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent bg-white dark:bg-slate-800 p-5 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tracking-wider uppercase">
              {language === 'pt' ? 'Total A Pagar (Pendente)' : 'Total Pending Payout'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <PoundSterling className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              £{summaryMetrics.totalPayrollPending.toFixed(2)}
            </div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
              {language === 'pt' ? 'Serviços concluídos a liquidar' : 'Unpaid completed jobs'}
            </p>
          </div>
        </div>

        {/* Pending Employees Count */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              {language === 'pt' ? 'Funcionários Pendentes' : 'Pending Staff'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summaryMetrics.pendingStaffCount}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'pt' ? 'Com saldo pendente no período' : 'With pending payout'}
            </p>
          </div>
        </div>

        {/* Paid Employees Count */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              {language === 'pt' ? 'Funcionários Pagos' : 'Paid Staff'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summaryMetrics.paidStaffCount}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {language === 'pt' ? 'Totalmente quitados no período' : 'Fully paid in period'}
            </p>
          </div>
        </div>

        {/* Total Worked Hours */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              {language === 'pt' ? 'Horas Totais Equipe' : 'Total Team Hours'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {summaryMetrics.totalHours.toFixed(1)}h
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'pt' ? 'Em serviços concluídos' : 'In completed services'}
            </p>
          </div>
        </div>
      </div>

      {payrollTab === 'current' ? (
        /* CURRENT PAYROLL LIST VIEW */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs space-y-4">
          {/* Controls Bar */}
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === 'pt' ? 'Buscar funcionário por nome ou cargo...' : 'Search staff by name or role...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Status:
              </span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {language === 'pt' ? 'Todos' : 'All'}
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-100'
                }`}
              >
                🟡 {language === 'pt' ? 'Pendentes' : 'Pending'}
              </button>
              <button
                onClick={() => setStatusFilter('PAID')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  statusFilter === 'PAID'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                🟢 {language === 'pt' ? 'Pagos' : 'Paid'}
              </button>
            </div>
          </div>

          {/* Table of Staff Payroll */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  <th className="py-3.5 px-6">{language === 'pt' ? 'Colaborador' : 'Employee'}</th>
                  <th className="py-3.5 px-4">{language === 'pt' ? 'Cargo' : 'Role'}</th>
                  <th className="py-3.5 px-4 text-center">{language === 'pt' ? 'Horas' : 'Hours'}</th>
                  <th className="py-3.5 px-4 text-right">{language === 'pt' ? 'Valor/Hora' : 'Rate (£/h)'}</th>
                  <th className="py-3.5 px-6 text-right">{language === 'pt' ? 'Total A Receber' : 'Total Pending'}</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-center">{language === 'pt' ? 'Ação' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {language === 'pt'
                        ? 'Nenhum colaborador encontrado para os filtros selecionados.'
                        : 'No staff members found matching selected filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s) => {
                    const isOwner = s.user.role === 'OWNER';
                    const hasPending = s.pendingAmount > 0;

                    return (
                      <tr
                        key={s.user.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors"
                      >
                        {/* Name & Avatar */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            {s.user.avatarUrl ? (
                              <img
                                src={s.user.avatarUrl}
                                alt={s.user.name}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-sm">
                                {s.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                {s.user.name}
                                {isOwner && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    OWNER
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {s.assignedCompletedJobs.length}{' '}
                                {language === 'pt' ? 'serviços no período' : 'jobs in period'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              isOwner
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                : s.user.role === 'ADMIN'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            }`}
                          >
                            {isOwner ? (
                              <Shield className="w-3 h-3" />
                            ) : s.user.role === 'ADMIN' ? (
                              <Building2 className="w-3 h-3" />
                            ) : (
                              <UserIcon className="w-3 h-3" />
                            )}
                            {s.user.role}
                          </span>
                        </td>

                        {/* Hours Worked */}
                        <td className="py-4 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                          {s.totalHours.toFixed(1)}h
                        </td>

                        {/* Hourly Rate */}
                        <td className="py-4 px-4 text-right font-medium text-slate-600 dark:text-slate-400">
                          {isOwner ? '—' : `£${s.hourlyRate.toFixed(2)}/h`}
                        </td>

                        {/* Total To Receive */}
                        <td className="py-4 px-6 text-right">
                          {isOwner ? (
                            <span className="text-slate-400 text-xs font-medium">£0.00 (Owner)</span>
                          ) : (
                            <div className="font-bold text-slate-900 dark:text-white text-base">
                              £{s.pendingAmount.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 text-center">
                          {isOwner ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400">
                              ⚪ Isento
                            </span>
                          ) : hasPending ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse">
                              🟡 {language === 'pt' ? 'Pendente' : 'Pending'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              🟢 {language === 'pt' ? 'Pago' : 'Paid'}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setSelectedStaffSummary(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-300 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {language === 'pt' ? 'Detalhamento' : 'Details'}
                            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PAYMENT HISTORY TAB VIEW */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs space-y-4">
          <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                {language === 'pt' ? 'Histórico de Pagamentos de Folha' : 'Payroll Payment History'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'pt'
                  ? 'Registros permanentes de pagamentos liquidados para a equipe'
                  : 'Permanent historical logs of processed staff payouts'}
              </p>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === 'pt' ? 'Filtrar histórico...' : 'Filter history...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-700/40 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                  <th className="py-3.5 px-6">{language === 'pt' ? 'Colaborador' : 'Employee'}</th>
                  <th className="py-3.5 px-4">{language === 'pt' ? 'Período Referência' : 'Period'}</th>
                  <th className="py-3.5 px-4 text-right">{language === 'pt' ? 'Valor Pago' : 'Amount Paid'}</th>
                  <th className="py-3.5 px-4 text-center">{language === 'pt' ? 'Horas Paid' : 'Hours'}</th>
                  <th className="py-3.5 px-4 text-center">{language === 'pt' ? 'Método' : 'Method'}</th>
                  <th className="py-3.5 px-6">{language === 'pt' ? 'Data / Hora' : 'Date & Time'}</th>
                  <th className="py-3.5 px-4">{language === 'pt' ? 'Pago por' : 'Paid By'}</th>
                  <th className="py-3.5 px-4 text-center">{language === 'pt' ? 'Ação' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {language === 'pt'
                        ? 'Nenhum pagamento registrado no histórico até o momento.'
                        : 'No payroll payments recorded in history yet.'}
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                        {p.staffName}
                      </td>
                      <td className="py-4 px-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {p.periodLabel}
                      </td>
                      <td className="py-4 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 text-base">
                        £{p.amount.toFixed(2)}
                      </td>
                      <td className="py-4 px-4 text-center font-medium text-slate-700 dark:text-slate-300">
                        {p.hours.toFixed(1)}h
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {p.paymentMethod === 'TRANSFER' ? (
                            <>
                              <CreditCard className="w-3 h-3 text-blue-500" /> Transferência
                            </>
                          ) : p.paymentMethod === 'CASH' ? (
                            <>
                              <Wallet className="w-3 h-3 text-emerald-500" /> Dinheiro
                            </>
                          ) : (
                            <>Outro</>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(p.paidAt).toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {p.paidBy}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => setDeleteConfirmPayment(p)}
                          title={language === 'pt' ? 'Excluir pagamento' : 'Delete payment'}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STAFF DETAIL DRAWER / MODAL */}
      {selectedStaffSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white relative">
              <button
                onClick={() => setSelectedStaffSummary(null)}
                className="absolute top-5 right-5 p-2 text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4">
                {selectedStaffSummary.user.avatarUrl ? (
                  <img
                    src={selectedStaffSummary.user.avatarUrl}
                    alt={selectedStaffSummary.user.name}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl border-2 border-white/20 shadow-md">
                    {selectedStaffSummary.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold">{selectedStaffSummary.user.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 font-semibold border border-blue-400/30">
                      {selectedStaffSummary.user.role}
                    </span>
                    {selectedStaffSummary.user.role !== 'OWNER' && (
                      <span className="text-xs text-slate-300">
                        £{selectedStaffSummary.hourlyRate.toFixed(2)}/hora
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Period & Totals Banner */}
              <div className="bg-slate-50 dark:bg-slate-700/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {language === 'pt' ? 'Período Selecionado:' : 'Selected Period:'}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {activePeriodLabel}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {language === 'pt' ? 'Horas Trabalhadas' : 'Hours Worked'}
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {selectedStaffSummary.totalHours.toFixed(1)}h
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      {language === 'pt' ? 'A Receber (Pendente)' : 'Pending Payout'}
                    </div>
                    <div className="text-lg font-black text-amber-600 dark:text-amber-400">
                      £{selectedStaffSummary.pendingAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {/* List of Jobs */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
                  <span>{language === 'pt' ? 'Serviços Concluídos no Período' : 'Completed Services in Period'}</span>
                  <span className="text-xs font-normal text-slate-500">
                    {selectedStaffSummary.assignedCompletedJobs.length} {language === 'pt' ? 'serviços' : 'jobs'}
                  </span>
                </h4>

                {selectedStaffSummary.assignedCompletedJobs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    {language === 'pt'
                      ? 'Nenhum serviço concluído por este colaborador neste período.'
                      : 'No completed services for this staff member in this period.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedStaffSummary.assignedCompletedJobs.map((job) => {
                      const isPaid = selectedStaffSummary.paidJobs.some((pj) => pj.id === job.id);
                      const count = (job.cleanerId ? job.cleanerId.split(',').length : 1) || 1;
                      const splitHours = (job.estimatedDuration || 0) / count;
                      const jobPay = selectedStaffSummary.user.role === 'OWNER' ? 0 : splitHours * selectedStaffSummary.hourlyRate;

                      return (
                        <div
                          key={job.id}
                          className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              {job.clientName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>📅 {job.date}</span>
                              <span>⏱️ {job.startTime} ({splitHours.toFixed(1)}h div.)</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                              £{jobPay.toFixed(2)}
                            </div>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-0.5 ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              }`}
                            >
                              {isPaid ? '🟢 Pago' : '🟡 Pendente'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStaffSummary(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold text-sm hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {language === 'pt' ? 'Fechar' : 'Close'}
                </button>

                <button
                  onClick={() => setClearHistoryStaffId(selectedStaffSummary.user.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl border border-red-200 dark:border-red-800 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {language === 'pt' ? 'Limpar Histórico de Pagamentos' : 'Clear Payment History'}
                </button>
              </div>

              {selectedStaffSummary.user.role !== 'OWNER' && selectedStaffSummary.pendingAmount > 0 && (
                <button
                  onClick={() => setPaymentModalStaff(selectedStaffSummary)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {language === 'pt' ? 'Marcar como Pago' : 'Mark as Paid'} (£{selectedStaffSummary.pendingAmount.toFixed(2)})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT CONFIRMATION MODAL */}
      {paymentModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {language === 'pt' ? 'Confirmar Pagamento' : 'Confirm Payment'}
                  </h3>
                  <p className="text-xs text-slate-500">{paymentModalStaff.user.name}</p>
                </div>
              </div>
              <button
                onClick={() => setPaymentModalStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-2xl text-center">
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                {language === 'pt' ? 'Valor a Liquidar' : 'Payout Amount'}
              </span>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                £{paymentModalStaff.pendingAmount.toFixed(2)}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                {paymentModalStaff.pendingHours.toFixed(1)}h • {paymentModalStaff.pendingJobs.length}{' '}
                {language === 'pt' ? 'serviços no período' : 'services in period'}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {language === 'pt' ? 'Forma de Pagamento:' : 'Payment Method:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <CreditCard className="w-5 h-5 mb-1" />
                  {language === 'pt' ? 'Transferência' : 'Bank Transfer'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Wallet className="w-5 h-5 mb-1" />
                  {language === 'pt' ? 'Dinheiro' : 'Cash'}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('OTHER')}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    paymentMethod === 'OTHER'
                      ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Building2 className="w-5 h-5 mb-1" />
                  {language === 'pt' ? 'Outro' : 'Other'}
                </button>
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {language === 'pt' ? 'Observação (Opcional):' : 'Notes (Optional):'}
              </label>
              <input
                type="text"
                placeholder={language === 'pt' ? 'Ex: Comprovante referente à 1ª semana' : 'e.g. Receipt ref week 1'}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setPaymentModalStaff(null)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold text-xs hover:text-slate-900 dark:hover:text-white"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {language === 'pt' ? 'Confirmar Pagamento' : 'Confirm Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SINGLE PAYMENT CONFIRMATION MODAL */}
      {deleteConfirmPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                onClick={() => setDeleteConfirmPayment(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {language === 'pt' ? 'Excluir Pagamento?' : 'Delete Payment?'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                {language === 'pt'
                  ? `Tem certeza que deseja excluir o registro de pagamento de £${deleteConfirmPayment.amount.toFixed(2)} para ${deleteConfirmPayment.staffName}?`
                  : `Are you sure you want to delete the payment of £${deleteConfirmPayment.amount.toFixed(2)} recorded for ${deleteConfirmPayment.staffName}?`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmPayment(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  deletePayrollPayment(deleteConfirmPayment.id);
                  setDeleteConfirmPayment(null);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-600/20 transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Excluir Definitivamente' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR ALL STAFF HISTORY CONFIRMATION MODAL */}
      {clearHistoryStaffId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <button
                onClick={() => setClearHistoryStaffId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {language === 'pt' ? 'Limpar Histórico de Pagamentos?' : 'Clear Payment History?'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                {language === 'pt'
                  ? 'Tem certeza de que deseja apagar TODO o histórico de pagamentos deste colaborador?'
                  : 'Are you sure you want to delete ALL payment history for this staff member?'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setClearHistoryStaffId(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  clearStaffPayrollPayments(clearHistoryStaffId);
                  setClearHistoryStaffId(null);
                  setSelectedStaffSummary(null);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-600/20 transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Apagar Histórico' : 'Clear History'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
