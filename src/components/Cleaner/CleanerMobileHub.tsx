import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CleaningJob } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { getCombinedJobsForDate } from '../../utils/scheduleGenerator';
import { SignatureModal } from '../SignatureModal';
import { ReceiptModal } from '../ReceiptModal';

export const CleanerMobileHub: React.FC = () => {
  const { jobs, clients, currentCompany, currentUser, updateJobStatus, addPhotoToJob, saveClientSignature, language } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter jobs for current logged in cleaner or assigned jobs using combined generator
  const todayJobs = getCombinedJobsForDate(jobs, clients, todayStr, currentCompany.id);
  const myJobs = todayJobs.filter(
    (j) => (j.cleanerId === currentUser.id || !j.cleanerId)
  );

  const [selectedJob, setSelectedJob] = useState<CleaningJob | null>(myJobs[0] || jobs[0]);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState<'BEFORE' | 'AFTER'>('BEFORE');

  // Personal metrics calculation
  const totalScheduledHours = myJobs.reduce((acc, j) => acc + (j.estimatedDuration || 0), 0);
  const cleanerRate = currentUser.hourlyRate || 14;
  const estimatedPersonalEarnings = totalScheduledHours * cleanerRate;

  // Photo uploads
  const samplePhotos = [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400',
    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&q=80&w=400',
  ];

  const handleUploadPhoto = () => {
    if (!selectedJob) return;
    const randomUrl = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    addPhotoToJob(selectedJob.id, {
      type: activePhotoType,
      url: randomUrl,
      caption: `${activePhotoType} clean inspection photo`,
    });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Mobile Top Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-5 rounded-3xl text-white shadow-lg space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <img
              src={logoImg}
              alt="W & J Cleaners"
              className="w-7 h-7 object-contain rounded-lg bg-white/10 p-0.5 border border-white/20"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = logoImg;
              }}
            />
            <h2 className="font-extrabold text-lg">{getTranslation(language, 'cleanerHubTitle')}</h2>
          </div>
          <span className="text-[10px] font-bold uppercase bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full">
            {getTranslation(language, 'mobileMode')}
          </span>
        </div>
        <p className="text-xs text-blue-200">
          {getTranslation(language, 'loggedInAs')} <strong className="text-white font-bold">{currentUser.name}</strong>
        </p>
      </div>

      {/* Cleaner Personal Rate & Earnings Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Seu Valor/Hora</span>
          <div className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 flex items-center justify-center gap-0.5">
            <PoundSterling className="w-4 h-4" />
            <span>{cleanerRate.toFixed(2)}/h</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Horas Hoje</span>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{totalScheduledHours}h</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs text-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Seu Ganho Estimado</span>
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
            <PoundSterling className="w-4 h-4" />
            <span>{estimatedPersonalEarnings.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Today's Job Selector Pills */}
      <div className="space-y-2">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {getTranslation(language, 'myTodayJobs')} ({myJobs.length})
        </h3>
        <div className="grid grid-cols-1 gap-2.5">
          {myJobs.map((job) => {
            const isSel = selectedJob?.id === job.id;
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
      </div>

      {/* Selected Job Workspace Controls */}
      {selectedJob && (
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-5">
          {/* Status Header */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                {selectedJob.clientName}
              </h3>
              <p className="text-xs text-slate-500">{selectedJob.address}, {selectedJob.postcode}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> {selectedJob.estimatedDuration}h
              </span>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                Seu valor: £{(selectedJob.estimatedDuration * cleanerRate).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Access Security Cards */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-500" /> {getTranslation(language, 'accessSecurityDetails')}
            </h4>
            {selectedJob.keyDetails && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'keyLocation')}</strong> {selectedJob.keyDetails}
              </div>
            )}
            {selectedJob.alarmCode && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'alarmCodeLabel')}</strong> {selectedJob.alarmCode}
              </div>
            )}
            {selectedJob.hasPets && (
              <div className="text-slate-600 dark:text-slate-300">
                <strong>{getTranslation(language, 'petsPresent')}</strong> {selectedJob.petNotes || 'Yes'}
              </div>
            )}
          </div>

          {/* GPS Checkin / Checkout Action */}
          <div>
            {selectedJob.status === 'SCHEDULED' && (
              <button
                onClick={() => updateJobStatus(selectedJob.id, 'IN_PROGRESS')}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md"
              >
                <MapPin className="w-4 h-4" /> {getTranslation(language, 'gpsCheckInStart')}
              </button>
            )}
            {selectedJob.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateJobStatus(selectedJob.id, 'COMPLETED')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" /> {getTranslation(language, 'gpsCheckOutFinish')}
              </button>
            )}
            {selectedJob.status === 'COMPLETED' && (
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
              {selectedJob.photos?.map((ph) => (
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
          if (selectedJob) saveClientSignature(selectedJob.id, sigData);
          setIsSignModalOpen(false);
        }}
        clientName={selectedJob?.clientName || ''}
      />

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        job={selectedJob}
      />
    </div>
  );
};
