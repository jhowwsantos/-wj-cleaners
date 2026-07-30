import React, { useState } from 'react';
import { X, Trash2, AlertTriangle, ShieldAlert, UserCheck, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';

interface DeleteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: User | null;
}

export const DeleteStaffModal: React.FC<DeleteStaffModalProps> = ({ isOpen, onClose, staffUser }) => {
  const { users, jobs, deleteUser, reassignUserJobs, currentUser } = useApp();

  const [replacementCleanerId, setReplacementCleanerId] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !staffUser) return null;

  const isOwner = currentUser.role === 'OWNER';
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const isTargetAdminOrOwner = staffUser.role === 'OWNER' || staffUser.role === 'ADMINISTRATOR';

  // Permission Guard: Administrator cannot delete Administrators or Owners
  if (isAdmin && isTargetAdminOrOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full text-center space-y-4 border border-slate-200 dark:border-slate-700">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ação Não Permitida</h3>
          <p className="text-xs text-slate-500">
            Apenas o Proprietário (Owner) tem autorização para excluir administradores da equipe.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 rounded-xl cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  // Find future scheduled jobs for this cleaner
  const futureJobs = jobs.filter(
    (j) =>
      (j.cleanerId === staffUser.id || (j.cleanerName && j.cleanerName.toLowerCase().includes(staffUser.name.toLowerCase()))) &&
      j.status !== 'COMPLETED' &&
      j.status !== 'CANCELLED'
  );

  // Eligible replacement cleaners (excluding staffUser being deleted)
  const availableCleaners = users.filter((u) => u.id !== staffUser.id && u.active !== false);

  const handleDelete = () => {
    setIsDeleting(true);

    // Reassign jobs if there are any
    if (futureJobs.length > 0) {
      const selectedCleaner = availableCleaners.find((c) => c.id === replacementCleanerId);
      const toName = selectedCleaner ? selectedCleaner.name : 'Não atribuído';
      reassignUserJobs(staffUser.id, replacementCleanerId || 'unassigned', toName);
    }

    // Delete user
    deleteUser(staffUser.id);
    setIsDeleting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-red-50/50 dark:bg-red-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Excluir Funcionário
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                Esta ação removerá o perfil de acesso.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Staff Info Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700">
            <img
              src={
                staffUser.avatarUrl ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
              }
              alt={staffUser.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-red-500/30"
            />
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                {staffUser.name}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">{staffUser.email}</p>
              <span className="inline-block mt-0.5 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                {staffUser.role}
              </span>
            </div>
          </div>

          {/* Warning Message if future jobs exist */}
          {futureJobs.length > 0 ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-extrabold text-xs">
                    {futureJobs.length} {futureJobs.length === 1 ? 'limpeza agendada encontrada' : 'limpezas agendadas encontradas'}
                  </h5>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    Este funcionário possui serviços em aberto na agenda. Escolha outro funcionário para assumir esses serviços antes de excluir.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-amber-900 dark:text-amber-100 flex items-center gap-1.5 mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-amber-600" /> Reatribuir serviços para:
                </label>
                <select
                  value={replacementCleanerId}
                  onChange={(e) => setReplacementCleanerId(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                >
                  <option value="">Nenhum (Deixar sem atribuir)</option>
                  {availableCleaners.map((cleaner) => (
                    <option key={cleaner.id} value={cleaner.id}>
                      {cleaner.name} ({cleaner.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tem certeza que deseja excluir <strong>{staffUser.name}</strong>? Este funcionário não possui limpezas agendadas no momento.
            </p>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-6 py-2.5 text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-md shadow-red-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Confirmar Exclusão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
