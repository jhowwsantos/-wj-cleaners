import React, { useState, useMemo } from 'react';
import logoImg from '../../assets/logo.png';
import {
  Smartphone,
  MapPin,
  Camera,
  CheckCircle2,
  FileText,
  Key,
  Upload,
  PoundSterling,
  Clock,
  User,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CleaningJob } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { CompanyLogo } from '../CompanyLogo';
import { getCombinedJobsForDate } from '../../utils/scheduleGenerator';
import {
  calculateUserMetrics,
  calculateJobFinancials,
  getAssignedStaffForJob,
} from '../../utils/financialCalculations';
import { SignatureModal } from '../SignatureModal';
import { ReceiptModal } from '../ReceiptModal';
import { ProfilePhotoModal } from '../ProfilePhotoModal';

export const CleanerMobileHub: React.FC = () => {
  const { jobs, clients, users, expenses, payrollPayments, currentCompany, currentUser, updateJobStatus, addPhotoToJob, saveClientSignature, language } = useApp();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter jobs for current logged in cleaner or assigned jobs using combined generator
  const todayJobs = useMemo(
    () => getCombinedJobsForDate(jobs, clients, todayStr, currentCompany.id),
    [jobs, clients, todayStr, currentCompany.id]
  );

  const myJobs = useMemo(() => {
    if (currentUser.role === 'OWNER') return todayJobs;
    return todayJobs.filter((j) => {
      const assigned = getAssignedStaffForJob(j, users);
      return (
        assigned.some((u) => u.id === currentUser.id) ||
        (j.cleanerId && j.cleanerId.includes(currentUser.id)) ||
        (j.cleanerName && j.cleanerName.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        !j.cleanerId
      );
    });
  }, [todayJobs, currentUser, users]);

  const [selectedJob, setSelectedJob] = useState<CleaningJob | null>(null);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState<'BEFORE' | 'AFTER'>('BEFORE');

  const effectiveJob =
    selectedJob && myJobs.some((j) => j.id === selectedJob.id)
      ? selectedJob
      : myJobs[0] || null;

  // For OWNER: company daily financials (matching Agenda Inteligente)
  const activeTodayJobs = useMemo(
    () => todayJobs.filter((j) => j.status !== 'CANCELLED'),
    [todayJobs]
  );

  const ownerMetrics = useMemo(() => {
    let totalRevenue = 0;
    let totalHours = 0;
    let staffCosts = 0;

    activeTodayJobs.forEach((j) => {
      const fin = calculateJobFinancials(j, users);
      totalRevenue += fin.clientRevenue;
      totalHours += fin.individualHours;
      staffCosts += fin.totalStaffExpenses;
    });

    const dailyExpenses = (expenses || [])
      .filter((e) => e.date === todayStr && e.companyId === currentCompany.id)
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const netProfit = totalRevenue - staffCosts - dailyExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalHours,
      staffCosts,
      dailyExpenses,
      netProfit,
      profitMargin,
      activeCount: activeTodayJobs.length,
    };
  }, [activeTodayJobs, expenses, todayStr, currentCompany.id, users]);

  // For CLEANER/ADMIN: Personal metrics calculation using multi-cleaner split rules
  const userMetrics = useMemo(
    () => calculateUserMetrics(currentUser, myJobs, users, payrollPayments),
    [currentUser, myJobs, users, payrollPayments]
  );
  const totalScheduledHours = Number(userMetrics.totalHoursWorked.toFixed(1));
  const cleanerRate = currentUser.hourlyRate || 0;
  const estimatedPersonalEarnings = userMetrics.totalEarnings;

  // Photo uploads
  const samplePhotos = [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&q=80&w=400',
  ];

  const handleUploadPhoto = () => {
    if (!effectiveJob) return;
    const randomUrl = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    addPhotoToJob(effectiveJob.id, {
      type: activePhotoType,
      url: randomUrl,
      caption: `${activePhotoType} clean inspection photo`,
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Mobile Top Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 rounded-3xl text-white shadow-lg space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <CompanyLogo company={currentCompany} className="w-8 h-8 rounded-lg" />
            <h2 className="font-extrabold text-lg">{getTranslation(language, 'cleanerHubTitle')}</h2>
          </div>
          <span className="text-[10px] font-bold uppercase bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
            {getTranslation(language, 'mobileMode')}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div
              onClick={() => setIsPhotoModalOpen(true)}
              className="relative group cursor-pointer shrink-0"
              title={language === 'pt' ? 'Tocar para alterar foto de perfil' : 'Tap to change profile photo'}
            >
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-400/50 group-hover:scale-105 transition-all"
              />
              <div className="absolute -bottom-1 -right-1 p-1 bg-blue-600 rounded-full text-white shadow-md border border-white">
                <Camera className="w-2.5 h-2.5" />
              </div>
            </div>
            <div>
              <p className="text-xs text-blue-200">
                {getTranslation(language, 'loggedInAs')}
              </p>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>{currentUser.name}</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-black uppercase bg-blue-500/30 text-blue-100">
                  {currentUser.role}
                </span>
              </h3>
            </div>
          </div>

          <button
            onClick={() => setIsPhotoModalOpen(true)}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{language === 'pt' ? 'Foto' : 'Photo'}</span>
          </button>
        </div>
      </div>

      {/* Financial Metrics Panel */}
      {currentUser.role === 'OWNER' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Receita Prevista */}
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <PoundSterling className="w-3.5 h-3.5 text-emerald-500" />
              {language === 'pt' ? 'Receita Prevista' : 'Expected Revenue'}
            </span>
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              £{ownerMetrics.totalRevenue.toFixed(2)}
            </div>
            <p className="text-[9px] text-slate-400 font-bold">
              {ownerMetrics.activeCount} {language === 'pt' ? 'serviço(s)' : 'job(s)'}
            </p>
          </div>

          {/* Horas Trabalhadas */}
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              {language === 'pt' ? 'Horas Trabalhadas' : 'Hours Worked'}
            </span>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">
              {ownerMetrics.totalHours.toFixed(1)}h
            </div>
            <p className="text-[9px] text-slate-400 font-bold">
              {language === 'pt' ? 'Total acumulado' : 'Total accumulated'}
            </p>
          </div>

          {/* Salários / Equipe */}
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <User className="w-3.5 h-3.5 text-amber-500" />
              {language === 'pt' ? 'Salários / Equipe' : 'Staff Wages'}
            </span>
            <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              £{ownerMetrics.staffCosts.toFixed(2)}
            </div>
            <p className="text-[9px] text-slate-400 font-bold">
              {language === 'pt' ? 'Custo direto' : 'Direct cost'}
            </p>
          </div>

          {/* Lucro Estimado */}
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              {language === 'pt' ? 'Lucro Estimado' : 'Estimated Profit'}
            </span>
            <div className={`text-base sm:text-lg font-black font-mono ${ownerMetrics.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              £{ownerMetrics.netProfit.toFixed(2)}
            </div>
            <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
              {ownerMetrics.profitMargin.toFixed(0)}% {language === 'pt' ? 'margem' : 'margin'}
            </p>
          </div>
        </div>
      ) : (
        /* Cleaner Personal Rate & Earnings Stats for CLEANER or ADMIN */
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{getTranslation(language, 'yourHourlyRate')}</span>
            <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 flex items-center justify-center gap-0.5">
              <PoundSterling className="w-4 h-4" />
              <span>{cleanerRate.toFixed(2)}/h</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{getTranslation(language, 'todayHours')}</span>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>{totalScheduledHours}h</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{getTranslation(language, 'yourEstimatedEarnings')}</span>
            <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
              <PoundSterling className="w-4 h-4" />
              <span>{estimatedPersonalEarnings.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Today's Job Selector Pills */}
      <div className="space-y-2">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {getTranslation(language, 'myTodayJobs')} ({myJobs.length})
        </h3>
        {myJobs.length === 0 ? (
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center space-y-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'noJobsScheduledToday')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {myJobs.map((job) => {
              const isSel = effectiveJob?.id === job.id;
              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSel
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 shadow-md'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono font-bold text-blue-600">{job.startTime} ({job.estimatedDuration}h)</span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                        {job.clientName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {job.address}, {job.postcode}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        job.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : job.status === 'IN_PROGRESS'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {job.status === 'COMPLETED'
                        ? getTranslation(language, 'completed')
                        : job.status === 'IN_PROGRESS'
                        ? getTranslation(language, 'inProgress')
                        : getTranslation(language, 'scheduled')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Job Workspace Controls */}
      {effectiveJob && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-5">
          {/* Status Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {effectiveJob.clientName}
              </h3>
              <p className="text-xs text-slate-500">{effectiveJob.address}, {effectiveJob.postcode}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> {effectiveJob.estimatedDuration}h
              </span>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                {getTranslation(language, 'yourValueLabel')} £{(effectiveJob.estimatedDuration * cleanerRate).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Access Security Cards */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-500" /> {getTranslation(language, 'accessSecurityDetails')}
            </h4>
            {effectiveJob.keyDetails && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'keyLocation')}</strong> {effectiveJob.keyDetails}
              </div>
            )}
            {effectiveJob.alarmCode && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'alarmCodeLabel')}</strong> {effectiveJob.alarmCode}
              </div>
            )}
            {effectiveJob.hasPets && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'petsPresent')}</strong> {effectiveJob.petNotes || 'Yes'}
              </div>
            )}
          </div>

          {/* GPS Checkin / Checkout Action */}
          <div>
            {effectiveJob.status === 'SCHEDULED' && (
              <button
                onClick={() => updateJobStatus(effectiveJob.id, 'IN_PROGRESS')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md"
              >
                <MapPin className="w-4 h-4" /> {getTranslation(language, 'gpsCheckInStart')}
              </button>
            )}
            {effectiveJob.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateJobStatus(effectiveJob.id, 'COMPLETED')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> {getTranslation(language, 'gpsCheckOutFinish')}
              </button>
            )}
            {effectiveJob.status === 'COMPLETED' && (
              <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 text-xs font-bold rounded-2xl text-center">
                {getTranslation(language, 'serviceCompletedVerified')}
              </div>
            )}
          </div>

          {/* Photos Upload Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" /> {getTranslation(language, 'jobInspectionPhotos')}
              </h4>
              <div className="flex gap-1">
                <button
                  onClick={() => setActivePhotoType('BEFORE')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                    activePhotoType === 'BEFORE' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600'
                  }`}
                >
                  {getTranslation(language, 'beforeLabel')}
                </button>
                <button
                  onClick={() => setActivePhotoType('AFTER')}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg ${
                    activePhotoType === 'AFTER' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600'
                  }`}
                >
                  {getTranslation(language, 'afterLabel')}
                </button>
              </div>
            </div>

            <button
              onClick={handleUploadPhoto}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-600"
            >
              <Upload className="w-4 h-4" /> {getTranslation(language, 'addPhoto')} (
              {activePhotoType === 'BEFORE' ? getTranslation(language, 'beforeLabel') : getTranslation(language, 'afterLabel')}
              )
            </button>

            {/* Gallery */}
            <div className="grid grid-cols-2 gap-2">
              {effectiveJob.photos?.map((ph) => (
                <div key={ph.id} className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={ph.url} alt={ph.caption} className="h-24 w-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                    {ph.type === 'BEFORE' ? getTranslation(language, 'beforeLabel') : getTranslation(language, 'afterLabel')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Client Signature & Receipt */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setIsSignModalOpen(true)}
              className="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-900 dark:text-indigo-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-indigo-200 dark:border-indigo-800"
            >
              {getTranslation(language, 'clientSignature')}
            </button>

            <button
              onClick={() => setIsReceiptModalOpen(true)}
              className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
            >
              <FileText className="w-4 h-4" /> {getTranslation(language, 'issueReceipt')}
            </button>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
        onSave={(sigData) => {
          if (effectiveJob) saveClientSignature(effectiveJob.id, sigData);
          setIsSignModalOpen(false);
        }}
        clientName={effectiveJob?.clientName || ''}
      />

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        job={effectiveJob}
      />

      {/* Profile Photo Modal */}
      <ProfilePhotoModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
      />
    </div>
  );
};
