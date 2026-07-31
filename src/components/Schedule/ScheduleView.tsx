import React, { useState, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  List as ListIcon,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  Play,
  Key,
  ShieldAlert,
  Dog,
  X,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Sparkles,
  Edit,
  Trash2,
  GripVertical,
  AlertTriangle,
  User,
  PoundSterling,
  ArrowRightLeft,
  TrendingUp,
  Navigation,
  Ban,
  RefreshCw,
  SlidersHorizontal,
  Coins,
  Layers,
  Building2,
  Search,
  Phone,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, sanitizeFirestoreData } from '../../lib/firebase';
import { useApp } from '../../context/AppContext';
import { CleaningJob } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { optimizeRoute } from '../../utils/routeOptimizer';
import {
  getCombinedJobsForDate,
  getCombinedJobsForMonth,
} from '../../utils/scheduleGenerator';
import { ReceiptModal } from '../ReceiptModal';

interface ScheduleViewProps {
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
}

const ScheduleViewComponent: React.FC<ScheduleViewProps> = ({
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
}) => {
  const {
    jobs,
    clients,
    updateClient,
    users,
    expenses,
    addJob,
    updateJob,
    updateJobStatus,
    assignCleanerToJob,
    deleteJob,
    language,
    userRole,
    currentUser,
    userLocation,
    currentCompany,
  } = useApp();

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];

  const [viewMode, setViewMode] = useState<'WEEK' | 'CALENDAR' | 'TIMELINE' | 'LIST'>('WEEK');
  const [currentYear, setCurrentYear] = useState<number>(todayObj.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(todayObj.getMonth()); // 0 - 11
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [cleanerFilter, setCleanerFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedReceiptJob, setSelectedReceiptJob] = useState<CleaningJob | null>(null);

  // Drag and drop state
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverTimeSlot, setDragOverTimeSlot] = useState<string | null>(null);

  // Intelligent Action Modals State
  const [swapSourceJob, setSwapSourceJob] = useState<CleaningJob | null>(null);
  const [quickRescheduleJob, setQuickRescheduleJob] = useState<CleaningJob | null>(null);
  const [deleteConfirmJob, setDeleteConfirmJob] = useState<CleaningJob | null>(null);
  const [cancelModalJob, setCancelModalJob] = useState<CleaningJob | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [showRouteModal, setShowRouteModal] = useState<boolean>(false);

  // Editing job state
  const [editingJob, setEditingJob] = useState<CleaningJob | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CleaningJob>>({});

  // Form state for new job modal
  const [formData, setFormData] = useState({
    clientId: clients[0]?.id || '',
    date: todayStr,
    startTime: '09:00',
    estimatedDuration: 2.5,
    price: 85,
    cleanerId: users[0]?.id || '',
    notes: '',
  });

  // Calculate monthly calendar jobs map including auto-recurring schedules (memoized)
  const monthJobsMap = useMemo(() => {
    const rawMap = getCombinedJobsForMonth(
      jobs,
      clients,
      currentYear,
      currentMonth,
      currentCompany.id
    );

    const map: Record<string, CleaningJob[]> = {};
    Object.keys(rawMap).forEach((dateKey) => {
      let dayList = rawMap[dateKey] || [];
      if (userRole === 'CLEANER') {
        dayList = dayList.filter((j) => j.cleanerId === currentUser.id);
      }
      map[dateKey] = dayList;
    });
    return map;
  }, [jobs, clients, currentYear, currentMonth, currentCompany.id, userRole, currentUser.id]);

  // Selected date jobs (memoized)
  const rawSelectedDateJobs = useMemo(() => {
    let rawJobs = getCombinedJobsForDate(
      jobs,
      clients,
      selectedDate,
      currentCompany.id
    );

    if (userRole === 'CLEANER') {
      rawJobs = rawJobs.filter((j) => j.cleanerId === currentUser.id);
    }
    return rawJobs;
  }, [jobs, clients, selectedDate, currentCompany.id, userRole, currentUser.id]);

  // Unified filter function supporting Search (Name, Address, Phone) & Filters (Cleaner, Status)
  const filterJobs = useCallback(
    (jobList: CleaningJob[]) => {
      return jobList.filter((j) => {
        if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;
        if (cleanerFilter !== 'ALL' && j.cleanerId !== cleanerFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = j.clientName?.toLowerCase().includes(q);
          const matchAddress =
            j.address?.toLowerCase().includes(q) || j.postcode?.toLowerCase().includes(q);
          const matchPhone =
            j.phone?.toLowerCase().includes(q) || j.whatsapp?.toLowerCase().includes(q);
          if (!matchName && !matchAddress && !matchPhone) return false;
        }
        return true;
      });
    },
    [statusFilter, cleanerFilter, searchQuery]
  );

  // Calculate 7-day week array starting from Monday to Sunday for selectedDate
  const weekDays = useMemo(() => {
    const parts = selectedDate.split('-');
    const curr = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const day = curr.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMon = curr.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(curr.setDate(diffToMon));

    const days = [];
    const ptDays = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const enDays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayOfWeek = d.getDay();

      days.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: language === 'pt' ? ptDays[dayOfWeek] : enDays[dayOfWeek],
        isToday: dateStr === todayStr,
        isMon: i === 0,
      });
    }
    return days;
  }, [selectedDate, language, todayStr]);

  const handlePrevWeek = () => {
    const parts = selectedDate.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const parts = selectedDate.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + 7);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const selectedDateJobs = useMemo(() => {
    return filterJobs(rawSelectedDateJobs);
  }, [rawSelectedDateJobs, filterJobs]);

  // Real-time recalculated Intelligent Metrics for the selected date
  const selectedDateMetrics = useMemo(() => {
    const activeJobs = rawSelectedDateJobs.filter((j) => j.status !== 'CANCELLED');
    const cancelledJobs = rawSelectedDateJobs.filter((j) => j.status === 'CANCELLED');

    const totalRevenue = activeJobs.reduce((acc, j) => acc + (j.price || 0), 0);
    const totalHours = activeJobs.reduce((acc, j) => acc + (j.estimatedDuration || 0), 0);

    // Cleaner wage costs calculation
    const staffCosts = activeJobs.reduce((acc, j) => {
      const cleaner = users.find((u) => u.id === j.cleanerId);
      const rate = cleaner?.hourlyRate || currentUser.hourlyRate || 14;
      return acc + rate * (j.estimatedDuration || 0);
    }, 0);

    // Expenses on this day
    const dailyExpenses = (expenses || [])
      .filter((e) => e.date === selectedDate && e.companyId === currentCompany.id)
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const netProfit = totalRevenue - staffCosts - dailyExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Route calculation: optimized driving sequence per cleaner starting from staff home addresses
    const cleanerJobMap = new Map<string, { cleaner: any; jobs: typeof activeJobs }>();
    activeJobs.forEach((job) => {
      const cId = job.cleanerId || 'unassigned';
      const foundCleaner = users.find((u) => u.id === cId) || null;
      if (!cleanerJobMap.has(cId)) {
        cleanerJobMap.set(cId, { cleaner: foundCleaner, jobs: [] });
      }
      cleanerJobMap.get(cId)!.jobs.push(job);
    });

    let totalMiles = 0;
    let totalTravelMinutes = 0;
    const allOrderedJobs: typeof activeJobs = [];

    cleanerJobMap.forEach(({ cleaner, jobs: staffJobs }) => {
      const homePostcode = cleaner?.homePostcode?.trim() || currentCompany.operationalBasePostcode || 'KT9 1BH';
      const homeAddress = cleaner?.homeAddress?.trim() || currentCompany.operationalBaseAddress || 'Hook Road, Chessington';
      const isCurrentLoggedInUser = cleaner?.id === currentUser?.id;
      const res = optimizeRoute(
        homePostcode,
        homeAddress,
        staffJobs,
        isCurrentLoggedInUser && userLocation ? userLocation : undefined
      );
      totalMiles += res.totalDistanceMiles;
      totalTravelMinutes += res.totalTravelTimeMinutes;
      allOrderedJobs.push(...res.jobsInOrder);
    });

    const routeResult = optimizeRoute(
      currentCompany.operationalBasePostcode || 'KT9 1BH',
      currentCompany.operationalBaseAddress || 'Hook Road, Chessington',
      allOrderedJobs.length > 0 ? allOrderedJobs : activeJobs
    );

    const routeList = (allOrderedJobs.length > 0 ? allOrderedJobs : activeJobs).map((job) => ({
      job,
      cleaner: job.cleanerName || users.find((u) => u.id === job.cleanerId)?.name || 'Não atribuído',
    }));

    return {
      activeCount: activeJobs.length,
      cancelledCount: cancelledJobs.length,
      totalRevenue,
      totalHours,
      staffCosts,
      dailyExpenses,
      netProfit,
      profitMargin,
      routeList,
      routeResult,
      originPostcode: currentCompany.operationalBasePostcode || 'KT9 1BH',
      originAddress: currentCompany.operationalBaseAddress || 'Hook Road, Chessington',
      estimatedMiles: Math.round(totalMiles * 10) / 10 || routeResult.totalDistanceMiles,
      estimatedTravelMinutes: totalTravelMinutes || routeResult.totalTravelTimeMinutes,
    };
  }, [
    rawSelectedDateJobs,
    users,
    currentUser.hourlyRate,
    expenses,
    selectedDate,
    currentCompany.id,
    currentCompany.operationalBasePostcode,
    currentCompany.operationalBaseAddress,
  ]);

  // Move job to specific time slot on current/target date
  const handleMoveJobToTimeSlot = (jobId: string, targetTimeStr: string, targetDateStr?: string) => {
    if (userRole === 'CLEANER') return;

    const dateToUse = targetDateStr || selectedDate;
    let targetJob: CleaningJob | undefined = rawSelectedDateJobs.find((j) => j.id === jobId);
    if (!targetJob) {
      for (const dKey of Object.keys(monthJobsMap)) {
        const match = monthJobsMap[dKey]?.find((j) => j.id === jobId);
        if (match) {
          targetJob = match;
          break;
        }
      }
    }

    if (!targetJob) return;

    if (targetJob.date !== dateToUse) {
      const oldDocId = `del_${targetJob.clientId}_${targetJob.date}`;
      const tombstone: CleaningJob = {
        ...targetJob,
        id: oldDocId,
        isDeleted: true,
        status: 'CANCELLED',
      };
      setDoc(doc(db, 'jobs', oldDocId), sanitizeFirestoreData(tombstone)).catch(() => {});
    }

    if (jobId.startsWith('virt_')) {
      addJob({
        ...targetJob,
        date: dateToUse,
        startTime: targetTimeStr,
      });
    } else {
      updateJob(jobId, { date: dateToUse, startTime: targetTimeStr });
    }
  };

  // Swap time slots between two jobs on the same or different days
  const handleSwapJobs = (job1: CleaningJob, targetJobId: string) => {
    if (userRole === 'CLEANER') return;
    const job2 = rawSelectedDateJobs.find((j) => j.id === targetJobId);
    if (!job2 || job1.id === job2.id) return;

    const time1 = job1.startTime;
    const time2 = job2.startTime;

    // Update job1 with job2's time
    if (job1.id.startsWith('virt_')) {
      addJob({ ...job1, startTime: time2 });
    } else {
      updateJob(job1.id, { startTime: time2 });
    }

    // Update job2 with job1's time
    if (job2.id.startsWith('virt_')) {
      addJob({ ...job2, startTime: time1 });
    } else {
      updateJob(job2.id, { startTime: time1 });
    }

    setSwapSourceJob(null);
  };

  // Cancel job keeping history
  const handleCancelWithHistory = (job: CleaningJob, reason: string) => {
    const cancelNote = reason.trim() ? `[Cancelado: ${reason.trim()}]` : '[Cancelado pelo administrador]';
    const updatedNotes = job.notes ? `${job.notes} | ${cancelNote}` : cancelNote;

    if (job.id.startsWith('virt_')) {
      addJob({
        ...job,
        status: 'CANCELLED',
        notes: updatedNotes,
      });
    } else {
      updateJob(job.id, {
        status: 'CANCELLED',
        notes: updatedNotes,
      });
    }

    setCancelModalJob(null);
    setCancellationReason('');
  };
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleGoToToday = () => {
    setCurrentYear(todayObj.getFullYear());
    setCurrentMonth(todayObj.getMonth());
    setSelectedDate(todayStr);
  };

  // Drag and drop reschedule handler
  const handleMoveJobToDate = (jobId: string, targetDateStr: string) => {
    if (userRole === 'CLEANER') return; // Cleaners cannot reschedule

    // Search for job in month map or selected date list
    let targetJob: CleaningJob | undefined = rawSelectedDateJobs.find((j) => j.id === jobId);
    if (!targetJob) {
      for (const dKey of Object.keys(monthJobsMap)) {
        const match = monthJobsMap[dKey]?.find((j) => j.id === jobId);
        if (match) {
          targetJob = match;
          break;
        }
      }
    }

    if (!targetJob) return;

    if (targetJob.date !== targetDateStr) {
      const oldDocId = `del_${targetJob.clientId}_${targetJob.date}`;
      const tombstone: CleaningJob = {
        ...targetJob,
        id: oldDocId,
        isDeleted: true,
        status: 'CANCELLED',
      };
      setDoc(doc(db, 'jobs', oldDocId), sanitizeFirestoreData(tombstone)).catch(() => {});
    }

    if (jobId.startsWith('virt_')) {
      // Convert virtual recurring instance to persisted Firestore record on new date
      addJob({
        ...targetJob,
        date: targetDateStr,
      });
    } else {
      // Update existing Firestore job date
      updateJob(jobId, { date: targetDateStr });
    }
  };

  // Job Actions
  const handleStartJob = (job: CleaningJob) => {
    if (job.id.startsWith('virt_')) {
      addJob({
        ...job,
        status: 'IN_PROGRESS',
      });
    } else {
      updateJobStatus(job.id, 'IN_PROGRESS');
    }
  };

  const handleCompleteJob = (job: CleaningJob) => {
    if (job.id.startsWith('virt_')) {
      addJob({
        ...job,
        status: 'COMPLETED',
      });
    } else {
      updateJobStatus(job.id, 'COMPLETED');
    }
  };

  const handleAssignCleaner = (job: CleaningJob, cleanerId: string) => {
    const cleaner = users.find((u) => u.id === cleanerId);
    if (job.id.startsWith('virt_')) {
      addJob({
        ...job,
        cleanerId,
        cleanerName: cleaner?.name || 'Assigned Staff',
      });
    } else {
      assignCleanerToJob(job.id, cleanerId, cleaner?.name || 'Assigned Staff');
    }
  };

  const handleDeleteJobAction = (job: CleaningJob) => {
    if (userRole === 'CLEANER') return;
    setDeleteConfirmJob(job);
  };

  const handleOpenEditModal = (job: CleaningJob) => {
    setEditingJob(job);
    setEditFormData({
      clientName: job.clientName,
      address: job.address,
      postcode: job.postcode,
      phone: job.phone || '',
      date: job.date,
      startTime: job.startTime,
      price: job.price,
      estimatedDuration: job.estimatedDuration,
      cleanerId: job.cleanerId || '',
      status: job.status,
      notes: job.notes || '',
    });
  };

  const handleSaveEditedJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    const cleaner = users.find((u) => u.id === editFormData.cleanerId);

    // Sync client profile details to Firestore if modified
    if (editingJob.clientId && (editFormData.clientName || editFormData.address || editFormData.postcode || editFormData.phone)) {
      updateClient(editingJob.clientId, {
        name: editFormData.clientName,
        address: editFormData.address,
        postcode: editFormData.postcode,
        phone: editFormData.phone,
      });
    }

    // If date was changed, write tombstone for old date so job disappears from old date
    if (editFormData.date && editFormData.date !== editingJob.date) {
      const oldDocId = `del_${editingJob.clientId}_${editingJob.date}`;
      const tombstone: CleaningJob = {
        ...editingJob,
        id: oldDocId,
        isDeleted: true,
        status: 'CANCELLED',
      };
      setDoc(doc(db, 'jobs', oldDocId), sanitizeFirestoreData(tombstone)).catch(() => {});
    }

    if (editingJob.id.startsWith('virt_')) {
      addJob({
        ...editingJob,
        ...editFormData,
        cleanerName: cleaner?.name || editingJob.cleanerName,
      });
    } else {
      updateJob(editingJob.id, {
        ...editFormData,
        cleanerName: cleaner?.name || editingJob.cleanerName,
      });
    }

    setEditingJob(null);
  };

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formData.clientId);
    const cleaner = users.find((u) => u.id === formData.cleanerId);

    if (!client) return;

    addJob({
      clientId: client.id,
      clientName: client.name,
      address: client.address,
      postcode: client.postcode,
      city: client.city,
      phone: client.phone,
      whatsapp: client.whatsapp,
      cleanerId: cleaner?.id || 'usr_jhonatan',
      cleanerName: cleaner?.name || 'Jhonatan Santos',
      date: formData.date,
      startTime: formData.startTime,
      estimatedDuration: Number(formData.estimatedDuration),
      price: Number(formData.price),
      status: 'SCHEDULED',
      paymentStatus: 'PENDING',
      notes: formData.notes,
      keyDetails: client.keyDetails,
      alarmCode: client.alarmCode,
      hasPets: client.hasPets,
      petNotes: client.petNotes,
    });

    onCloseAddModal();
  };

  const handleClientChange = (cId: string) => {
    const client = clients.find((c) => c.id === cId);
    if (client) {
      setFormData({
        ...formData,
        clientId: cId,
        price: client.defaultPrice,
        estimatedDuration: client.estimatedDuration,
      });
    }
  };

  // Month grid calculations
  const monthDateObj = new Date(currentYear, currentMonth, 1);
  const monthName = monthDateObj.toLocaleDateString(
    language === 'pt' ? 'pt-BR' : 'en-GB',
    { month: 'long', year: 'numeric' }
  );

  const firstDayWeekday = monthDateObj.getDay(); // 0 = Sun
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Days array for calendar grid
  const calendarCells = [];
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const prevDayNum = prevMonthDays - i;
    const prevMonthNum = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYearNum = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${prevYearNum}-${String(prevMonthNum + 1).padStart(2, '0')}-${String(
      prevDayNum
    ).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNum: prevDayNum,
      isCurrentMonth: false,
    });
  }

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(
      dayNum
    ).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: true,
    });
  }

  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let dayNum = 1; dayNum <= remainingCells; dayNum++) {
    const nextMonthNum = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYearNum = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${nextYearNum}-${String(nextMonthNum + 1).padStart(2, '0')}-${String(
      dayNum
    ).padStart(2, '0')}`;
    calendarCells.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
    });
  }

  const weekDayHeaders = [
    getTranslation(language, 'sunShort'),
    getTranslation(language, 'monShort'),
    getTranslation(language, 'tueShort'),
    getTranslation(language, 'wedShort'),
    getTranslation(language, 'thuShort'),
    getTranslation(language, 'friShort'),
    getTranslation(language, 'satShort'),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {getTranslation(language, 'scheduleTitle')}
            {userRole === 'CLEANER' && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-md font-bold">
                Meus Serviços
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {userRole === 'CLEANER'
              ? 'Visualize seus serviços atribuídos e atualize o status em tempo real.'
              : 'Agenda em formato calendário editável. Arraste e solte (Drag & Drop) para mover limpezas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Switcher Pills */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-xs">
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'WEEK'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              7 Dias da Semana
            </button>
            <button
              onClick={() => setViewMode('CALENDAR')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'CALENDAR'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {getTranslation(language, 'calendarView')}
            </button>
            <button
              onClick={() => setViewMode('TIMELINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'TIMELINE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Horários (Timeline)
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'LIST'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
              {getTranslation(language, 'listView')}
            </button>
          </div>

          {userRole !== 'CLEANER' && (
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" /> {getTranslation(language, 'btnNewJob')}
            </button>
          )}
        </div>
      </div>

      {/* Smart Intelligent Recalculation Metrics Panel */}
      <div className="bg-slate-900 dark:bg-slate-950 text-white p-5 rounded-3xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
                Agenda Inteligente Recalculada
                <span className="text-[10px] font-mono font-bold bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30">
                  {selectedDate}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Receita, lucro, horas trabalhadas e rota recalculados automaticamente em tempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowRouteModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Navigation className="w-3.5 h-3.5" /> Ver Rota Otimizada ({selectedDateMetrics.routeList.length})
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Revenue */}
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <PoundSterling className="w-3.5 h-3.5 text-emerald-400" /> Receita Prevista
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-emerald-400 font-mono">
                £{selectedDateMetrics.totalRevenue.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                {selectedDateMetrics.activeCount} serviço(s)
              </span>
            </div>
          </div>

          {/* Hours */}
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-400" /> Horas Trabalhadas
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-blue-300 font-mono">
                {selectedDateMetrics.totalHours.toFixed(1)}h
              </span>
              <span className="text-[10px] text-slate-400">
                Total estimado
              </span>
            </div>
          </div>

          {/* Staff Cost */}
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-amber-400" /> Salários / Equipe
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-xl font-black text-amber-300 font-mono">
                £{selectedDateMetrics.staffCosts.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                Custo direto
              </span>
            </div>
          </div>

          {/* Net Profit */}
          <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Lucro Estimado
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-xl font-black font-mono ${selectedDateMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                £{selectedDateMetrics.netProfit.toFixed(2)}
              </span>
              <span className="text-[10px] text-emerald-300 font-extrabold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/50">
                {selectedDateMetrics.profitMargin.toFixed(0)}% margem
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Search and Filter Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar cliente, endereço, telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Cleaner Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={cleanerFilter}
              onChange={(e) => setCleanerFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Funcionários</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="IN_PROGRESS">Em Andamento</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl">
            <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 7-DAY WEEK VIEW MODE */}
      {viewMode === 'WEEK' && (
        <div className="space-y-6">
          {/* Week Control & Navigation Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevWeek}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Semana Anterior
                </button>
                <button
                  onClick={handleNextWeek}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1"
                >
                  Próxima Semana <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                Semana: {weekDays[0]?.dateStr} a {weekDays[6]?.dateStr}
              </h3>

              <button
                onClick={handleGoToToday}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
              >
                {getTranslation(language, 'today')}
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
              Visualização Completa de 7 Dias
            </div>
          </div>

          {/* 7 Days Columns / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {weekDays.map((dayItem) => {
              const rawDayJobs = getCombinedJobsForDate(jobs, clients, dayItem.dateStr, currentCompany.id);
              const dayJobsFiltered = filterJobs(
                userRole === 'CLEANER' ? rawDayJobs.filter((j) => j.cleanerId === currentUser.id) : rawDayJobs
              ).sort((a, b) => a.startTime.localeCompare(b.startTime));

              return (
                <div
                  key={dayItem.dateStr}
                  className={`bg-white dark:bg-slate-800 rounded-2xl border ${
                    dayItem.isToday
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 dark:border-slate-700'
                  } p-3 flex flex-col justify-between shadow-xs min-h-[320px] transition-all`}
                >
                  {/* Day Header */}
                  <div className="pb-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="font-black text-xs text-slate-900 dark:text-white block">
                        {dayItem.dayName}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                        {dayItem.dateStr}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        dayItem.isToday
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dayJobsFiltered.length}
                    </span>
                  </div>

                  {/* Job Cards List */}
                  <div className="py-2.5 space-y-2.5 flex-1 overflow-y-auto max-h-[550px]">
                    {dayJobsFiltered.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-xs italic">
                        Sem agendamentos
                      </div>
                    ) : (
                      dayJobsFiltered.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-blue-500 transition-all shadow-xs space-y-2 group"
                        >
                          {/* Header: Time & Status selector */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono font-extrabold text-[11px] text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded">
                              {job.startTime} ({job.estimatedDuration}h)
                            </span>
                            <select
                              value={job.status}
                              onChange={(e) =>
                                updateJobStatus(job.id, e.target.value as CleaningJob['status'])
                              }
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-lg border outline-none cursor-pointer ${
                                job.status === 'COMPLETED'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                                  : job.status === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                  : job.status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800'
                              }`}
                            >
                              <option value="SCHEDULED">Agendado</option>
                              <option value="IN_PROGRESS">Em andamento</option>
                              <option value="COMPLETED">Concluído</option>
                              <option value="CANCELLED">Cancelado</option>
                            </select>
                          </div>

                          {/* Client Name & Price */}
                          <div className="flex justify-between items-start gap-1">
                            <h4
                              onClick={() => handleOpenEditModal(job)}
                              className="font-extrabold text-xs text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer line-clamp-1"
                              title="Clique para editar"
                            >
                              {job.clientName}
                            </h4>
                            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400 shrink-0 font-mono">
                              £{job.price}
                            </span>
                          </div>

                          {/* Address */}
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 line-clamp-1">
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            {job.address}, {job.postcode}
                          </p>

                          {/* Phone if available */}
                          {job.phone && (
                            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                              {job.phone}
                            </p>
                          )}

                          {/* Staff */}
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                            <span>
                              Staff:{' '}
                              <strong className="text-slate-700 dark:text-slate-200">
                                {job.cleanerName || 'Não atribuído'}
                              </strong>
                            </span>
                          </div>

                          {/* Actions Bar */}
                          <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-1">
                            <button
                              onClick={() => handleOpenEditModal(job)}
                              className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[10px] font-bold flex items-center gap-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
                              title="Editar Agendamento"
                            >
                              <Edit className="w-3 h-3" /> Editar
                            </button>
                            <button
                              onClick={() => setQuickRescheduleJob(job)}
                              className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-bold flex items-center gap-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
                              title="Remarcar para outra data"
                            >
                              <Repeat className="w-3 h-3" /> Remarcar
                            </button>
                            {userRole !== 'CLEANER' && (
                              <button
                                onClick={() => setDeleteConfirmJob(job)}
                                className="px-1.5 py-1 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-[10px] font-bold flex items-center gap-1 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800"
                                title="Excluir Agendamento"
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CALENDAR VIEW MODE */}
      {viewMode === 'CALENDAR' ? (
        <div className="space-y-6">
          {/* Calendar Control Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  title={getTranslation(language, 'previousMonth')}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  title={getTranslation(language, 'nextMonth')}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white capitalize">
                {monthName}
              </h3>

              <button
                onClick={handleGoToToday}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
              >
                {getTranslation(language, 'today')}
              </button>
            </div>

            {/* Auto Recurring Legend Banner */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
              <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{getTranslation(language, 'autoRecurringNotice')}</span>
            </div>
          </div>

          {/* Interactive Calendar Month Grid with Drag & Drop */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            {/* Weekday Row */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 text-center font-bold text-xs text-slate-600 dark:text-slate-400">
              {weekDayHeaders.map((dayName, idx) => (
                <div key={idx} className="py-2.5 uppercase tracking-wider">
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-700/60">
              {calendarCells.map((cell) => {
                const dayJobs = monthJobsMap[cell.dateStr] || [];
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                const isDragTarget = dragOverDate === cell.dateStr;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedDate(cell.dateStr)}
                    onDragOver={(e) => {
                      if (userRole !== 'CLEANER') {
                        e.preventDefault();
                        setDragOverDate(cell.dateStr);
                      }
                    }}
                    onDragLeave={() => setDragOverDate(null)}
                    onDrop={(e) => {
                      if (userRole !== 'CLEANER') {
                        e.preventDefault();
                        setDragOverDate(null);
                        const jId = e.dataTransfer.getData('text/plain');
                        if (jId) {
                          handleMoveJobToDate(jId, cell.dateStr);
                        }
                      }
                    }}
                    className={`min-h-[90px] sm:min-h-[115px] p-1.5 sm:p-2 cursor-pointer transition-all flex flex-col justify-between ${
                      !cell.isCurrentMonth
                        ? 'bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 dark:text-slate-600'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-750'
                    } ${
                      isSelected
                        ? 'ring-2 ring-blue-600 dark:ring-blue-500 bg-blue-50/30 dark:bg-blue-950/20 z-10'
                        : ''
                    } ${
                      isDragTarget
                        ? 'bg-blue-100/80 dark:bg-blue-900/50 border-2 border-dashed border-blue-500 ring-4 ring-blue-400/30'
                        : ''
                    }`}
                  >
                    {/* Day Number Header */}
                    <div className="flex justify-between items-center">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-xs font-black'
                            : isSelected
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {dayJobs.length > 0 && (
                        <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded-md">
                          {dayJobs.length}
                        </span>
                      )}
                    </div>

                    {/* Desktop Event Chips (Draggable for Admin/Owner) */}
                    <div className="mt-1 space-y-1 overflow-hidden">
                      {dayJobs.slice(0, 2).map((job) => {
                        const isCompleted = job.status === 'COMPLETED';
                        const isInProgress = job.status === 'IN_PROGRESS';

                        return (
                          <div
                            key={job.id}
                            draggable={userRole !== 'CLEANER'}
                            onDragStart={(e) => {
                              if (userRole !== 'CLEANER') {
                                e.stopPropagation();
                                e.dataTransfer.setData('text/plain', job.id);
                                setDraggedJobId(job.id);
                              }
                            }}
                            className={`p-1 text-[10px] font-semibold rounded-md truncate flex items-center justify-between gap-1 border transition-all ${
                              userRole !== 'CLEANER' ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02]' : ''
                            } ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-800'
                                : isInProgress
                                ? 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800'
                                : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-800'
                            }`}
                          >
                            <span className="truncate font-bold flex items-center gap-1">
                              {userRole !== 'CLEANER' && <GripVertical className="w-2.5 h-2.5 opacity-60 shrink-0" />}
                              {job.startTime} {job.clientName}
                            </span>
                            {userRole !== 'CLEANER' ? (
                              <span className="shrink-0 text-[9px] font-mono">£{job.price}</span>
                            ) : (
                              <span className="shrink-0 text-[9px] font-mono text-slate-500">{job.estimatedDuration}h</span>
                            )}
                          </div>
                        );
                      })}

                      {dayJobs.length > 2 && (
                        <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 text-center">
                          +{dayJobs.length - 2} {getTranslation(language, 'more') || 'mais'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Jobs Drawer / Schedule Panel */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {getTranslation(language, 'scheduledJobsCount')}:{' '}
                  <span className="text-blue-600 dark:text-blue-400">{selectedDate}</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold text-xs">
                  {rawSelectedDateJobs.length}
                </span>
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      statusFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? getTranslation(language, 'all')
                      : st === 'SCHEDULED'
                      ? getTranslation(language, 'scheduled')
                      : st === 'IN_PROGRESS'
                      ? getTranslation(language, 'inProgress')
                      : getTranslation(language, 'completed')}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Date Job Cards */}
            <div className="space-y-3">
              {selectedDateJobs.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-2xl text-center text-slate-500 dark:text-slate-400 text-xs font-medium border border-dashed border-slate-200 dark:border-slate-700">
                  {getTranslation(language, 'noJobsForSelectedDay')}
                </div>
              ) : (
                selectedDateJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950 px-2 py-0.5 rounded">
                          {job.startTime}
                        </span>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {job.clientName}
                        </h4>
                        {userRole !== 'CLEANER' ? (
                          <span className="text-xs font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            £{job.price}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">
                            Sua Hora: £{(currentUser.hourlyRate || 14).toFixed(2)}/h
                          </span>
                        )}
                        {job.id.startsWith('virt_') && (
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                            <Repeat className="w-3 h-3" /> Recorrente
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span>{job.address}, {job.postcode}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{job.estimatedDuration} {getTranslation(language, 'hours')}</span>
                        </div>
                      </div>

                      {/* Key & Alarm badges */}
                      <div className="flex flex-wrap gap-1.5 text-[11px] pt-0.5">
                        {job.keyDetails && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Key className="w-3 h-3" /> {getTranslation(language, 'keyLabel')} {job.keyDetails}
                          </span>
                        )}
                        {job.alarmCode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <ShieldAlert className="w-3 h-3" /> {getTranslation(language, 'alarmLabel')} {job.alarmCode}
                          </span>
                        )}
                        {job.hasPets && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Dog className="w-3 h-3" /> {getTranslation(language, 'petsLabel')} {job.petNotes || 'Sim'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions & Cleaner Assignment */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-700">
                      {userRole !== 'CLEANER' && (
                        <>
                          <select
                            value={job.cleanerId || ''}
                            onChange={(e) => handleAssignCleaner(job, e.target.value)}
                            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none"
                          >
                            <option value="">{getTranslation(language, 'unassigned')}</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name}
                              </option>
                            ))}
                          </select>

                          {job.status !== 'CANCELLED' && (
                            <>
                              <button
                                onClick={() => setSwapSourceJob(job)}
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                title="Trocar Horário de Cliente"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Trocar</span>
                              </button>

                              <button
                                onClick={() => setQuickRescheduleJob(job)}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                title="Reagendar Data/Horário"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Mover</span>
                              </button>

                              <button
                                onClick={() => setCancelModalJob(job)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                                title="Cancelar (Mantendo no Histórico)"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">Cancelar</span>
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(job)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                            title="Editar Agendamento"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteJobAction(job)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                            title="Excluir Definitivamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <span
                        className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                          job.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 line-through'
                            : job.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : job.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                        }`}
                      >
                        {job.status === 'CANCELLED'
                          ? 'CANCELADO'
                          : job.status === 'COMPLETED'
                          ? getTranslation(language, 'completed')
                          : job.status === 'IN_PROGRESS'
                          ? getTranslation(language, 'inProgress')
                          : getTranslation(language, 'scheduled')}
                      </span>

                      {job.status === 'SCHEDULED' && (
                        <button
                          onClick={() => handleStartJob(job)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> {getTranslation(language, 'start')}
                        </button>
                      )}

                      {job.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleCompleteJob(job)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> {getTranslation(language, 'complete')}
                        </button>
                      )}

                      {job.status === 'COMPLETED' && (
                        <button
                          onClick={() => setSelectedReceiptJob(job)}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl"
                        >
                          {getTranslation(language, 'receipt')}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : viewMode === 'TIMELINE' ? (
        /* TIMELINE VIEW MODE */
        <div className="space-y-4">
          {/* Date Navigator Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToToday}
                className="px-3 py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800"
              >
                {getTranslation(language, 'today')}
              </button>
            </div>

            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Arraste e solte o agendamento no bloco de horário para alterar em tempo real.
            </span>
          </div>

          {/* Hourly Slots Grid */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 shadow-sm overflow-hidden">
            {['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map((timeSlot) => {
              const hourPrefix = timeSlot.substring(0, 2);
              const slotJobs = rawSelectedDateJobs.filter((j) => j.startTime.startsWith(hourPrefix));
              const isTargetSlot = dragOverTimeSlot === timeSlot;

              return (
                <div
                  key={timeSlot}
                  onDragOver={(e) => {
                    if (userRole !== 'CLEANER') {
                      e.preventDefault();
                      setDragOverTimeSlot(timeSlot);
                    }
                  }}
                  onDragLeave={() => setDragOverTimeSlot(null)}
                  onDrop={(e) => {
                    if (userRole !== 'CLEANER') {
                      e.preventDefault();
                      setDragOverTimeSlot(null);
                      const jobId = e.dataTransfer.getData('text/plain');
                      if (jobId) {
                        handleMoveJobToTimeSlot(jobId, timeSlot);
                      }
                    }
                  }}
                  className={`p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all ${
                    isTargetSlot
                      ? 'bg-blue-100/70 dark:bg-blue-950/70 ring-2 ring-blue-500 ring-inset'
                      : 'hover:bg-slate-50/70 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="w-20 shrink-0 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-200">
                      {timeSlot}
                    </span>
                  </div>

                  <div className="flex-1 w-full flex flex-wrap gap-2 items-center min-h-[40px]">
                    {slotJobs.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">Nenhum serviço agendado para as {timeSlot}</span>
                    ) : (
                      slotJobs.map((job) => (
                        <div
                          key={job.id}
                          draggable={userRole !== 'CLEANER'}
                          onDragStart={(e) => {
                            if (userRole !== 'CLEANER') {
                              e.dataTransfer.setData('text/plain', job.id);
                              setDraggedJobId(job.id);
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-xs transition-all ${
                            userRole !== 'CLEANER' ? 'cursor-grab active:cursor-grabbing hover:scale-[1.01]' : ''
                          } ${
                            job.status === 'CANCELLED'
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200'
                              : job.status === 'COMPLETED'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200'
                              : job.status === 'IN_PROGRESS'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-200'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-200 border-blue-200'
                          }`}
                        >
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{job.clientName}</span>
                          <span className="text-[10px] opacity-75 font-mono">({job.estimatedDuration}h)</span>
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">£{job.price}</span>

                          {userRole !== 'CLEANER' && (
                            <div className="flex items-center gap-1 ml-1 border-l border-slate-200/60 dark:border-slate-700 pl-1.5">
                              <button
                                onClick={() => setSwapSourceJob(job)}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
                                title="Trocar Horário"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                              </button>
                              <button
                                onClick={() => setQuickRescheduleJob(job)}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
                                title="Mover"
                              >
                                <Clock className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {userRole !== 'CLEANER' && (
                    <button
                      onClick={() => {
                        setFormData({ ...formData, startTime: timeSlot, date: selectedDate });
                        onOpenAddModal();
                      }}
                      className="px-2.5 py-1 text-[11px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 rounded-lg shrink-0"
                    >
                      + Horário
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* LIST VIEW MODE */
        <div className="space-y-4">
          {/* Date Navigator Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
              />
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(d.toISOString().split('T')[0]);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleGoToToday}
                className="px-3 py-2 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800"
              >
                {getTranslation(language, 'today')}
              </button>
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL'
                    ? getTranslation(language, 'all')
                    : st === 'SCHEDULED'
                    ? getTranslation(language, 'scheduled')
                    : st === 'IN_PROGRESS'
                    ? getTranslation(language, 'inProgress')
                    : getTranslation(language, 'completed')}
                </button>
              ))}
            </div>
          </div>

          {/* Jobs List Grid */}
          <div className="space-y-3">
            {selectedDateJobs.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 p-12 rounded-3xl border border-slate-200 dark:border-slate-700 text-center text-slate-400 text-sm">
                {getTranslation(language, 'noJobsForDate')} {selectedDate}.
              </div>
            ) : (
              selectedDateJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-200/60 dark:border-blue-800">
                        {job.startTime}
                      </span>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        {job.clientName}
                      </h3>
                      {userRole !== 'CLEANER' ? (
                        <span className="font-black text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                          £{job.price}
                        </span>
                      ) : (
                        <span className="font-bold text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                          Sua Hora: £{(currentUser.hourlyRate || 14).toFixed(2)}/h
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>{job.address}, <strong className="text-slate-800 dark:text-slate-200">{job.postcode}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{job.estimatedDuration} {getTranslation(language, 'hours')}</span>
                      </div>
                    </div>

                    {/* Key / Alarm Badges */}
                    <div className="flex flex-wrap gap-2 text-[11px]">
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
                          <Dog className="w-3 h-3" /> {getTranslation(language, 'petsLabel')} {job.petNotes || 'Sim'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cleaner Assign & Status Controls */}
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-700">
                    {userRole !== 'CLEANER' && (
                      <>
                        <select
                          value={job.cleanerId || ''}
                          onChange={(e) => handleAssignCleaner(job, e.target.value)}
                          className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none"
                        >
                          <option value="">{getTranslation(language, 'unassigned')}</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleOpenEditModal(job)}
                          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors"
                          title="Editar Agendamento"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteJobAction(job)}
                          className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 rounded-xl transition-colors"
                          title="Excluir Agendamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <span
                      className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full ${
                        job.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                          : job.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                      }`}
                    >
                      {job.status === 'COMPLETED'
                        ? getTranslation(language, 'completed')
                        : job.status === 'IN_PROGRESS'
                        ? getTranslation(language, 'inProgress')
                        : getTranslation(language, 'scheduled')}
                    </span>

                    {job.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handleStartJob(job)}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> {getTranslation(language, 'start')}
                      </button>
                    )}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleCompleteJob(job)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> {getTranslation(language, 'complete')}
                      </button>
                    )}
                    {job.status === 'COMPLETED' && (
                      <button
                        onClick={() => setSelectedReceiptJob(job)}
                        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl"
                      >
                        {getTranslation(language, 'receipt')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                Editar Agendamento
              </h3>
              <button onClick={() => setEditingJob(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedJob} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.clientName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, clientName: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Endereço
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.address || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Postcode
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.postcode || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, postcode: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={editFormData.date || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Horário de Início
                  </label>
                  <input
                    type="time"
                    required
                    value={editFormData.startTime || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, startTime: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Preço (£)
                  </label>
                  <input
                    type="number"
                    required
                    value={editFormData.price || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Duração Estimada (h)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={editFormData.estimatedDuration || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, estimatedDuration: Number(e.target.value) })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Funcionário Atribuído
                </label>
                <select
                  value={editFormData.cleanerId || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, cleanerId: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Sem funcionário</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Status do Serviço
                </label>
                <select
                  value={editFormData.status || 'SCHEDULED'}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as CleaningJob['status'] })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="SCHEDULED">Agendado (SCHEDULED)</option>
                  <option value="IN_PROGRESS">Em Andamento (IN_PROGRESS)</option>
                  <option value="COMPLETED">Concluído (COMPLETED)</option>
                  <option value="CANCELLED">Cancelado (CANCELLED)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações / Serviço
                </label>
                <textarea
                  rows={2}
                  value={editFormData.notes || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickRescheduleJob(editingJob);
                      setEditingJob(null);
                    }}
                    className="px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300 rounded-xl hover:bg-indigo-100 flex items-center gap-1"
                  >
                    <Repeat className="w-3.5 h-3.5" /> Remarcar
                  </button>
                  {userRole !== 'CLEANER' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmJob(editingJob);
                        setEditingJob(null);
                      }}
                      className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 rounded-xl hover:bg-rose-100 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingJob(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
              </h3>
              <button onClick={() => setDeleteConfirmJob(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Tem certeza que deseja excluir este agendamento?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O serviço para <strong className="text-slate-800 dark:text-slate-200">{deleteConfirmJob.clientName}</strong> no dia <strong className="text-slate-800 dark:text-slate-200">{deleteConfirmJob.date}</strong> será permanentemente removido do banco de dados e da agenda.
              </p>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setDeleteConfirmJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (deleteConfirmJob) {
                    deleteJob(deleteConfirmJob.id, deleteConfirmJob);
                  }
                  setDeleteConfirmJob(null);
                }}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-rose-500/20"
              >
                Sim, Excluir Agendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap Job Modal */}
      {swapSourceJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" /> Trocar Horário de Cliente
              </h3>
              <button onClick={() => setSwapSourceJob(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Selecione outro agendamento de <span className="font-bold">{selectedDate}</span> para trocar de horário com <span className="font-extrabold text-blue-600">{swapSourceJob.clientName}</span> ({swapSourceJob.startTime}):
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {rawSelectedDateJobs
                .filter((j) => j.id !== swapSourceJob.id)
                .map((targetJ) => (
                  <button
                    key={targetJ.id}
                    onClick={() => handleSwapJobs(swapSourceJob, targetJ.id)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{targetJ.clientName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Horário atual: {targetJ.startTime}</div>
                    </div>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-1 rounded-lg">
                      Trocar por {targetJ.startTime}
                    </span>
                  </button>
                ))}

              {rawSelectedDateJobs.filter((j) => j.id !== swapSourceJob.id).length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400 italic">
                  Não há outros agendamentos neste dia para trocar.
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSwapSourceJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reschedule Modal */}
      {quickRescheduleJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" /> Reagendar Limpeza
              </h3>
              <button onClick={() => setQuickRescheduleJob(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Reagende o serviço de <span className="font-bold text-slate-900 dark:text-white">{quickRescheduleJob.clientName}</span>. O faturamento e as rotas serão recalculados automaticamente.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nova Data</label>
                <input
                  type="date"
                  defaultValue={quickRescheduleJob.date}
                  id="quick_new_date"
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Novo Horário</label>
                <input
                  type="time"
                  defaultValue={quickRescheduleJob.startTime}
                  id="quick_new_time"
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold font-mono text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setQuickRescheduleJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const dateInput = (document.getElementById('quick_new_date') as HTMLInputElement)?.value;
                  const timeInput = (document.getElementById('quick_new_time') as HTMLInputElement)?.value;
                  if (dateInput && timeInput) {
                    handleMoveJobToTimeSlot(quickRescheduleJob.id, timeInput, dateInput);
                    setQuickRescheduleJob(null);
                  }
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-500/20"
              >
                Confirmar Reagendamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal (Preserves History) */}
      {cancelModalJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Ban className="w-5 h-5" /> Cancelar Limpeza (Mantendo Histórico)
              </h3>
              <button onClick={() => setCancelModalJob(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O agendamento de <span className="font-bold text-slate-900 dark:text-white">{cancelModalJob.clientName}</span> será marcado como <span className="font-extrabold text-red-600">CANCELADO</span>. Ele permanecerá no histórico do cliente para auditoria e o faturamento do dia será recalculado.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Motivo do Cancelamento
              </label>
              <textarea
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Cliente solicitou reagendamento para o próximo mês devido a viagem."
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setCancelModalJob(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl"
              >
                Voltar
              </button>
              <button
                onClick={() => handleCancelWithHistory(cancelModalJob, cancellationReason)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-amber-500/20"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Modal */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Navigation className="w-5 h-5 text-blue-600" /> Rota Inteligente de Limpeza ({selectedDate})
              </h3>
              <button onClick={() => setShowRouteModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/60 p-3 rounded-2xl border border-blue-200 dark:border-blue-800 text-xs">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Distância Estimada: </span>
                <span className="font-mono font-extrabold text-blue-700 dark:text-blue-300">
                  {selectedDateMetrics.estimatedMiles} miles
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300">Tempo de Deslocamento: </span>
                <span className="font-mono font-extrabold text-blue-700 dark:text-blue-300">
                  ~{selectedDateMetrics.estimatedTravelMinutes} min
                </span>
              </div>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {/* Home Base / Depot Start Point */}
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-3 shadow-xs">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-extrabold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                  BASE
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-xs text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" /> Home Base / Depot (Ponto Inicial)
                    </span>
                    <span className="font-mono font-extrabold text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                      {selectedDateMetrics.originPostcode}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" /> {selectedDateMetrics.originAddress}, {selectedDateMetrics.originPostcode}
                  </p>
                </div>
              </div>

              {selectedDateMetrics.routeList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Nenhum serviço ativo para esta data.</p>
              ) : (
                selectedDateMetrics.routeList.map((item, idx) => (
                  <div
                    key={item.job.id}
                    className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      #{idx + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{item.job.clientName}</span>
                        <span className="font-mono font-extrabold text-[11px] text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded">
                          {item.job.startTime}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" /> {item.job.address}, {item.job.postcode}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Responsável: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.cleaner}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2">
              {selectedDateMetrics.routeResult?.googleMapsUrl ? (
                <a
                  href={selectedDateMetrics.routeResult.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Navigation className="w-3.5 h-3.5" /> Abrir no Google Maps
                </a>
              ) : null}
              <button
                onClick={() => setShowRouteModal(false)}
                className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedReceiptJob)}
        onClose={() => setSelectedReceiptJob(null)}
        job={selectedReceiptJob}
      />
    </div>
  );
};

export const ScheduleView = React.memo(ScheduleViewComponent);
