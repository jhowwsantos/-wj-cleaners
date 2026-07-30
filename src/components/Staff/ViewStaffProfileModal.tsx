import React, { useState } from 'react';
import {
  X,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  PoundSterling,
  Mail,
  Phone,
  MapPin,
  Shield,
  FileText,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User as UserType } from '../../types';

interface ViewStaffProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: UserType | null;
}

export const ViewStaffProfileModal: React.FC<ViewStaffProfileModalProps> = ({ isOpen, onClose, staffUser }) => {
  const { jobs, clients, userRole } = useApp();
  const [activeTab, setActiveTab] = useState<'schedule' | 'history' | 'clients'>('schedule');

  if (!isOpen || !staffUser) return null;

  // Filter jobs for this staff user
  const userJobs = jobs.filter(
    (j) =>
      j.cleanerId === staffUser.id ||
      (j.cleanerName && j.cleanerName.toLowerCase().includes(staffUser.name.toLowerCase()))
  );

  const upcomingJobs = userJobs.filter((j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED');
  const completedJobs = userJobs.filter((j) => j.status === 'COMPLETED');

  // Worked hours calculation
  const totalHoursWorked = completedJobs.reduce((acc, j) => acc + (j.estimatedDuration || 0), 0);
  const totalUpcomingHours = upcomingJobs.reduce((acc, j) => acc + (j.estimatedDuration || 0), 0);
  const rate = staffUser.hourlyRate || 14;
  const estimatedEarnings = totalHoursWorked * rate;

  // Unique clients served
  const servedClientIds = Array.from(new Set(userJobs.map((j) => j.clientId)));
  const servedClientsList = clients.filter((c) => servedClientIds.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header Bar */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <img
              src={
                staffUser.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
              }
              alt={staffUser.name}
              className="w-20 h-20 rounded-2xl object-cover ring-4 ring-blue-500/40 shadow-lg shrink-0"
            />
            <div className="text-center sm:text-left space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-black">{staffUser.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {staffUser.role}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    staffUser.active !== false
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {staffUser.active !== false ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span>{staffUser.email}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{staffUser.phone}</span>
                </div>
                {staffUser.homePostcode && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    <span>{staffUser.homePostcode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="p-6 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horas Trabalhadas</span>
            <div className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{totalHoursWorked}h</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Valor/Hora</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
              <PoundSterling className="w-4 h-4" />
              <span>{rate.toFixed(2)}/h</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Concluídas</span>
            <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{completedJobs.length}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clientes Atendidos</span>
            <div className="text-lg font-black text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1">
              <Users className="w-4 h-4" />
              <span>{servedClientsList.length}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-4 flex border-b border-slate-200 dark:border-slate-700 gap-4 text-xs font-bold">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'schedule'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Agenda ({upcomingJobs.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Histórico ({completedJobs.length})
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`pb-3 transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'clients'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Clientes ({servedClientsList.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-80 overflow-y-auto space-y-3">
          {activeTab === 'schedule' && (
            <>
              {upcomingJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhuma limpeza futura agendada para este funcionário.
                </div>
              ) : (
                upcomingJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {job.clientName}
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                          {job.startTime} ({job.estimatedDuration}h)
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{job.address}, {job.postcode}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 block">
                        {job.date}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        £{(job.estimatedDuration * rate).toFixed(2)} est.
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {completedJobs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum histórico de limpeza concluída encontrado.
                </div>
              ) : (
                completedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {job.clientName}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                          Concluído
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{job.address} • {job.estimatedDuration}h</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        {job.date}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {job.invoiceNumber || 'INV-PASSED'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'clients' && (
            <>
              {servedClientsList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Nenhum cliente cadastrado atendido ainda.
                </div>
              ) : (
                servedClientsList.map((client) => {
                  const clientCleans = userJobs.filter((j) => j.clientId === client.id);
                  return (
                    <div
                      key={client.id}
                      className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <h4 className="font-extrabold text-slate-900 dark:text-white">
                          {client.name}
                        </h4>
                        <p className="text-slate-500 text-[11px]">{client.address}, {client.postcode}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 px-2.5 py-1 rounded-xl border border-purple-200 dark:border-purple-800">
                          {clientCleans.length} {clientCleans.length === 1 ? 'limpeza' : 'limpezas'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
