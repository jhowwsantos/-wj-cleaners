import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar,
  Users,
  PoundSterling,
  TrendingUp,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  Plus,
  Navigation,
  CheckCircle2,
  Key,
  ShieldAlert,
  Play,
  Dog,
  AlertCircle,
  UserCheck,
  ExternalLink,
  ChevronRight,
  Map as MapIcon,
  DollarSign,
  Briefcase,
  Smartphone,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { CleaningJob } from '../../types';
import { getCombinedJobsForDate } from '../../utils/scheduleGenerator';
import { calculateJobFinancials, getAssignedStaffForJob } from '../../utils/financialCalculations';
import { optimizeRoute } from '../../utils/routeOptimizer';
import { CleanerMobileHub } from '../Cleaner/CleanerMobileHub';
import { LiveRouteMap } from './LiveRouteMap';

interface DashboardViewProps {
  onOpenNewClientModal: () => void;
  onOpenNewJobModal: () => void;
}

const DashboardViewComponent: React.FC<DashboardViewProps> = ({
  onOpenNewClientModal,
  onOpenNewJobModal,
}) => {
  const {
    jobs,
    clients,
    currentCompany,
    users,
    language,
    setActiveTab,
    updateJobStatus,
    userRole,
    currentUser,
    expenses,
    userLocation,
  } = useApp();

  const [selectedMapJob, setSelectedMapJob] = useState<CleaningJob | null>(null);
  const [selectedCleanerId, setSelectedCleanerId] = useState<string | 'ALL'>('ALL');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Memoized Calculations
  const todayJobs = useMemo(
    () => getCombinedJobsForDate(jobs, clients, todayStr, currentCompany.id),
    [jobs, clients, todayStr, currentCompany.id]
  );
  const firstName = useMemo(() => currentUser?.name ? (currentUser.name.split(' ')[0] || currentUser.name) : '', [currentUser?.name]);

  const isCleanerRole = userRole === 'CLEANER' || currentUser?.role === 'CLEANER';

  // Filter jobs and calculate optimized route for Google Maps button matching the Live Map selection exactly
  const liveRouteJobs = useMemo(() => {
    if (isCleanerRole && currentUser) {
      return todayJobs.filter(
        (job) =>
          getAssignedStaffForJob(job, users).some((u) => u.id === currentUser.id) ||
          job.cleanerId?.includes(currentUser.id)
      );
    }
    if (selectedCleanerId !== 'ALL') {
      return todayJobs.filter(
        (job) =>
          job.cleanerId === selectedCleanerId ||
          getAssignedStaffForJob(job, users).some((u) => u.id === selectedCleanerId)
      );
    }
    return todayJobs;
  }, [todayJobs, isCleanerRole, currentUser, selectedCleanerId, users]);

  const routeLeader = useMemo(() => {
    if (isCleanerRole) return currentUser;
    if (selectedCleanerId !== 'ALL') {
      return users.find((u) => u.id === selectedCleanerId) || null;
    }
    // When selectedCleanerId === 'ALL', check assigned staff on today's jobs for an OWNER or staff member with home address
    const assignedStaff = users.filter((u) =>
      liveRouteJobs.some((j) => getAssignedStaffForJob(j, users).some((st) => st.id === u.id) || j.cleanerId === u.id)
    );
    const ownerStaff = assignedStaff.find((u) => u.role === 'OWNER' && u.homeAddress && u.homeAddress.trim() !== '');
    if (ownerStaff) return ownerStaff;

    const staffWithAddress = assignedStaff.find((u) => u.homeAddress && u.homeAddress.trim() !== '');
    if (staffWithAddress) return staffWithAddress;

    // Check if any company OWNER has a registered home address
    const companyOwner = users.find((u) => u.role === 'OWNER' && u.homeAddress && u.homeAddress.trim() !== '');
    if (companyOwner) return companyOwner;

    return currentUser;
  }, [isCleanerRole, currentUser, selectedCleanerId, users, liveRouteJobs]);

  const isLeaderLoggedInUser = Boolean(currentUser && routeLeader && currentUser.id === routeLeader.id);
  const isGpsActive = Boolean(userLocation && (isLeaderLoggedInUser || userRole === 'OWNER' || userRole === 'ADMINISTRATOR'));

  const originPostcode = useMemo(() => {
    if (routeLeader?.homePostcode && routeLeader.homePostcode.trim() !== '') {
      return routeLeader.homePostcode.trim();
    }
    return currentCompany.operationalBasePostcode || 'KT9 1BH';
  }, [routeLeader, currentCompany]);

  const originAddress = useMemo(() => {
    if (routeLeader?.homeAddress && routeLeader.homeAddress.trim() !== '') {
      return routeLeader.homeAddress.trim();
    }
    return currentCompany.operationalBaseAddress || 'Hook Road, Chessington';
  }, [routeLeader, currentCompany]);

  const liveRouteResult = useMemo(() => {
    return optimizeRoute(
      originPostcode,
      originAddress,
      liveRouteJobs,
      isGpsActive && userLocation ? userLocation : undefined
    );
  }, [originPostcode, originAddress, liveRouteJobs, isGpsActive, userLocation]);

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date === todayStr)
        .reduce((acc, e) => acc + e.amount, 0),
    [expenses, todayStr]
  );

  const todayFinancials = useMemo(() => {
    let revenue = 0;
    let staffWages = 0;
    todayJobs.forEach((j) => {
      const fin = calculateJobFinancials(j, users);
      revenue += fin.clientRevenue;
      staffWages += fin.totalStaffExpenses;
    });
    const netProfit = revenue - staffWages - todayExpenses;
    return {
      revenue,
      staffWages,
      netProfit,
    };
  }, [todayJobs, users, todayExpenses]);

  const todayRevenue = todayFinancials.revenue;
  const estimatedCleanerCost = todayFinancials.staffWages;
  const todayProfit = todayFinancials.netProfit;

  const pendingPayments = useMemo(
    () =>
      jobs
        .filter(
          (j) =>
            !j.isDeleted &&
            j.status !== 'CANCELLED' &&
            (j.paymentStatus === 'PENDING' || (j.status === 'COMPLETED' && j.paymentStatus !== 'PAID'))
        )
        .reduce((acc, j) => acc + (j.price || 0), 0),
    [jobs]
  );

  const upcomingJobsCount = useMemo(
    () => todayJobs.filter((j) => j.status === 'SCHEDULED' || j.status === 'EN_ROUTE').length,
    [todayJobs]
  );

  const activeCleanersToday = useMemo(
    () =>
      Array.from(new Set(todayJobs.map((j) => j.cleanerId).filter(Boolean))).length ||
      Math.min(todayJobs.length, users.filter((u) => u.role === 'CLEANER').length),
    [todayJobs, users]
  );

  if (userRole === 'CLEANER') {
    return <CleanerMobileHub />;
  }

  // Mock revenue chart data for current week
  const weekData = [
    { day: 'Mon', revenue: 240, profit: 150 },
    { day: 'Tue', revenue: 310, profit: 210 },
    { day: 'Wed', revenue: 280, profit: 180 },
    { day: 'Thu', revenue: 390, profit: 260 },
    { day: 'Fri', revenue: 450, profit: 300 },
    { day: 'Sat', revenue: 320, profit: 220 },
    { day: 'Sun', revenue: 190, profit: 120 },
  ];

  // Map coordinates simulation for London postcodes
  const mapPins = todayJobs.map((job, idx) => {
    // Generate realistic relative pin positions based on index
    const offsets = [
      { x: 30, y: 35, label: 'Central (SW1A)' },
      { x: 62, y: 25, label: 'City (EC1A)' },
      { x: 48, y: 65, label: 'Soho (W1D)' },
      { x: 75, y: 50, label: 'Islington (N1)' },
      { x: 25, y: 70, label: 'Kensington (W8)' },
    ];
    const pos = offsets[idx % offsets.length];
    return { ...job, pinX: pos.x, pinY: pos.y, district: pos.label };
  });

  const activeJob = selectedMapJob || todayJobs[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden border border-blue-800/50">
        <Sparkles className="w-48 h-48 absolute -right-10 -bottom-10 opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col items-start justify-center space-y-2.5 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 backdrop-blur-md rounded-full text-xs font-bold text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>UK Cleaning Business SaaS Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2 text-left leading-tight">
              {getTranslation(language, 'welcomeBack')}, {firstName} 👋
            </h2>
            <p className="text-sm text-blue-100 font-medium text-left leading-normal">
              {todayJobs.length} {getTranslation(language, 'scheduledToday')}.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <button
              onClick={() => setActiveTab('route')}
              className="group flex-1 sm:flex-none px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-left border border-emerald-400/30"
            >
              <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                <Navigation className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
                <span>{getTranslation(language, 'btnOptimizeRoute')}</span>
              </div>
              <div className="text-[10px] text-emerald-100 mt-0.5 font-normal">
                {getTranslation(language, 'optimizeTravelTime')}
              </div>
            </button>

            {userRole !== 'CLEANER' && (
              <div className="flex gap-2">
                <button
                  onClick={onOpenNewClientModal}
                  className="px-3.5 py-3 bg-white text-blue-900 hover:bg-blue-50 font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-blue-600" /> {getTranslation(language, 'btnNewClient')}
                </button>
                <button
                  onClick={onOpenNewJobModal}
                  className="px-3.5 py-3 bg-blue-800/80 hover:bg-blue-800 text-white font-bold text-xs rounded-2xl border border-white/20 flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Calendar className="w-4 h-4" /> {getTranslation(language, 'btnNewJob')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Today's Jobs */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-blue-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'todaysJobs')}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {todayJobs.length}
          </div>
          <div className="text-[10px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 inline" />
            {todayJobs.filter((j) => j.status === 'COMPLETED').length} {getTranslation(language, 'done')}
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'todayRevenue')}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <PoundSterling className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            £{todayRevenue.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{getTranslation(language, 'scheduledTotal')}</div>
        </div>

        {/* Today's Profit */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-indigo-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'todaysProfit')}
            </span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            £{todayProfit.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{getTranslation(language, 'netMargin')} ~{todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100) : 0}%</div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-amber-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'pendingPayments')}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            £{pendingPayments.toFixed(0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{getTranslation(language, 'toCollect')}</div>
        </div>

        {/* Upcoming Jobs */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-purple-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'upcomingJobs')}
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {upcomingJobsCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{getTranslation(language, 'remainingToday')}</div>
        </div>

        {/* Cleaners Working Today */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs hover:border-cyan-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {getTranslation(language, 'cleanersActive')}
            </span>
            <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {activeCleanersToday}
          </div>
          <div className="text-[10px] text-cyan-600 font-semibold mt-1">{getTranslation(language, 'onRoute')}</div>
        </div>
      </div>

      {/* Integrated Interactive Google Map & Route Section */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/80">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <MapIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {getTranslation(language, 'liveRouteTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {getTranslation(language, 'liveRouteSubtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('route')}
              className="px-3 py-1.5 text-xs font-bold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" /> {getTranslation(language, 'openFullRoutePlanner')}
            </button>
            {liveRouteResult.googleMapsUrl && (
              <a
                href={liveRouteResult.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {getTranslation(language, 'googleMaps')}
              </a>
            )}
          </div>
        </div>

        {/* Interactive Map Section */}
        <div className="relative h-80 sm:h-96 bg-slate-100 dark:bg-slate-900 overflow-hidden">
          <LiveRouteMap
            todayJobs={todayJobs}
            users={users}
            selectedJob={activeJob}
            onSelectJob={(job) => setSelectedMapJob(job)}
            selectedCleanerId={selectedCleanerId}
            onSelectCleaner={(cId) => setSelectedCleanerId(cId)}
          />
        </div>
      </div>

      {/* Main Grid: Visual Agenda Timeline & Today's Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agenda Visual Timeline (Left / Center 2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {getTranslation(language, 'agendaTimeline')}
            </h3>
            <button
              onClick={() => setActiveTab('schedule')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {getTranslation(language, 'fullScheduleAgenda')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            {todayJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {getTranslation(language, 'noJobsScheduledToday')}
              </div>
            ) : (
              <div className="relative border-l-2 border-blue-200 dark:border-blue-900/60 ml-4 pl-6 space-y-6">
                {todayJobs.map((job, idx) => (
                  <div key={job.id} className="relative group">
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 transition-all ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                          : job.status === 'IN_PROGRESS'
                          ? 'bg-amber-500 ring-4 ring-amber-500/30 animate-pulse'
                          : 'bg-blue-600'
                      }`}
                    />

                    {/* Timeline Item Content Card */}
                    <div className="bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400 transition-all space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-950 px-2.5 py-1 rounded-lg">
                            {job.startTime}
                          </span>
                          <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                            {job.clientName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-slate-900 dark:text-white">
                            £{job.price}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                              job.status === 'IN_PROGRESS'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                : job.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                            }`}
                          >
                            {job.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Address & Cleaner */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span>{job.address}, <strong>{job.postcode}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{getTranslation(language, 'cleanerLabel')} <strong>{job.cleanerName || 'Assigned Cleaner'}</strong></span>
                        </div>
                      </div>

                      {/* Key & Pet Badges */}
                      <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                        {job.keyDetails && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Key className="w-3 h-3" /> {getTranslation(language, 'keyLabel')} {job.keyDetails}
                          </span>
                        )}
                        {job.alarmCode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <ShieldAlert className="w-3 h-3" /> {getTranslation(language, 'alarmLabel')} {job.alarmCode}
                          </span>
                        )}
                        {job.hasPets && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Dog className="w-3 h-3" /> {getTranslation(language, 'petsLabel')} {job.petNotes || 'Yes'}
                          </span>
                        )}
                      </div>

                      {/* Quick Action Button */}
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-end gap-2">
                        {job.status === 'SCHEDULED' && (
                          <button
                            onClick={() => updateJobStatus(job.id, 'IN_PROGRESS')}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" /> {getTranslation(language, 'startService')}
                          </button>
                        )}
                        {job.status === 'IN_PROGRESS' && (
                          <button
                            onClick={() => updateJobStatus(job.id, 'COMPLETED')}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> {getTranslation(language, 'completeService')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Weekly Financial Trend & Cleaner Mobile Quick Hub */}
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {getTranslation(language, 'weeklyRevenueTrend')}
                </h4>
                <p className="text-[11px] text-slate-500">{getTranslation(language, 'revenueVsProfit')}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                {getTranslation(language, 'vsLastWeek')}
              </span>
            </div>

            <div className="h-44 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weekData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: 'none',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cleaner Mobile App Shortcut Card */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 p-5 rounded-3xl text-white border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm">{getTranslation(language, 'cleanerMobileHub')}</h4>
                <p className="text-[11px] text-slate-300">{getTranslation(language, 'cleanerMobileSub')}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {getTranslation(language, 'cleanerMobileDesc')}
            </p>
            <button
              onClick={() => setActiveTab('cleaner_hub')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {getTranslation(language, 'openCleanerMobileInterface')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardView = React.memo(DashboardViewComponent);
