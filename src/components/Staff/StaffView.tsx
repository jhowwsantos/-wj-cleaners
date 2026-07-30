import React, { useState, useMemo } from 'react';
import {
  Users,
  Phone,
  Mail,
  Shield,
  MapPin,
  CheckCircle2,
  Lock,
  UserCheck,
  Building2,
  ShieldAlert,
  UserPlus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  PoundSterling,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { AddStaffModal } from './AddStaffModal';
import { EditStaffModal } from './EditStaffModal';
import { DeleteStaffModal } from './DeleteStaffModal';
import { ViewStaffProfileModal } from './ViewStaffProfileModal';
import { User, UserRole } from '../../types';

const StaffViewComponent: React.FC = () => {
  const { users, language, currentUser } = useApp();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<User | null>(null);
  const [viewingStaff, setViewingStaff] = useState<User | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const isOwner = currentUser.role === 'OWNER';
  const isAdmin = currentUser.role === 'ADMINISTRATOR';
  const canManageStaff = isOwner || isAdmin;

  // Filtered users list (memoized)
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.phone.toLowerCase().includes(term);

      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && user.active !== false) ||
        (statusFilter === 'INACTIVE' && user.active === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  if (!canManageStaff) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-amber-200 dark:border-amber-900/50 shadow-sm max-w-2xl mx-auto text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          {getTranslation(language, 'restrictedTitle')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
          {getTranslation(language, 'restrictedText')}
        </p>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl">
            <Lock className="w-3.5 h-3.5 text-amber-500" /> {getTranslation(language, 'restrictedBadge')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            {getTranslation(language, 'staffTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastre, edite e controle as permissões, cargos e agenda da equipe de funcionários.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Cadastrar Funcionário</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 rounded-2xl text-white shadow-md space-y-2 border border-slate-800">
        <div className="flex items-center gap-2 font-bold text-sm text-blue-300">
          <Building2 className="w-4 h-4 text-amber-400" /> Controle Seguro de Permissões
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong>Proprietários (Owner):</strong> Possuem controle total para gerenciar, editar e excluir qualquer administrador ou faxineiro.
          <br />
          <strong>Administradores (Admin):</strong> Podem gerenciar exclusivamente funcionários do tipo <i>Cleaner</i>.
        </p>
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2.5 pl-9 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-slate-500 font-medium shrink-0">Cargo:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer w-full"
            >
              <option value="ALL">Todos os Cargos</option>
              <option value="OWNER">Proprietário (Owner)</option>
              <option value="ADMINISTRATOR">Administrador</option>
              <option value="CLEANER">Funcionário (Cleaner)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto">
            <span className="text-slate-500 font-medium shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-900 dark:text-white outline-none cursor-pointer w-full"
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Staff Cards Grid */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700 space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhum funcionário encontrado
          </h3>
          <p className="text-xs text-slate-500">
            Tente ajustar os termos de pesquisa ou os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredUsers.map((user) => {
            const isOwnerUser = user.role === 'OWNER';
            const isAdminUser = user.role === 'ADMINISTRATOR';

            // Check if current user can edit/delete this specific target user
            const canManageTarget =
              isOwner || (!isAdminUser && !isOwnerUser);

            return (
              <div
                key={user.id}
                className={`bg-white dark:bg-slate-800 p-6 rounded-2xl border ${
                  isOwnerUser
                    ? 'border-amber-300 dark:border-amber-700/80 shadow-md ring-1 ring-amber-400/20'
                    : 'border-slate-200 dark:border-slate-700/80 shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all'
                } space-y-4 flex flex-col justify-between`}
              >
                <div className="space-y-4">
                  {/* Top Info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          user.avatarUrl ||
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
                        }
                        alt={user.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/30 shrink-0"
                      />
                      <div>
                        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                          {user.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase ${
                              isOwnerUser
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                                : isAdminUser
                                ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
                                : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                            }`}
                          >
                            {isOwnerUser ? (
                              <Shield className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                            )}
                            {user.role}
                          </span>

                          <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                            <PoundSterling className="w-3 h-3" />
                            {(user.hourlyRate || 14).toFixed(2)}/h
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border shrink-0 ${
                        user.active !== false
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {user.active !== false ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{getTranslation(language, 'emailLabel')} <strong>{user.email}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{getTranslation(language, 'phoneLabel')} <strong>{user.phone}</strong></span>
                    </div>
                    {user.homeAddress ? (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          Endereço Base: <strong>{user.homeAddress}</strong>
                        </span>
                      </div>
                    ) : user.homePostcode ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Postcode: <strong>{user.homePostcode}</strong></span>
                      </div>
                    ) : null}
                  </div>

                  {/* Permissions Overview */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Nível de Acesso
                    </div>
                    {isOwnerUser ? (
                      <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span>{getTranslation(language, 'fullAdminAccess')}</span>
                      </div>
                    ) : isAdminUser ? (
                      <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
                        <span>Gestão Operacional de Clientes, Agenda e Faxineiros</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>Acesso ao App Mobile de Faxina, Check-in GPS e Fotos</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons: Visualizar, Editar, Excluir */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
                  {/* Visualizar Button */}
                  <button
                    onClick={() => setViewingStaff(user)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                    title="Visualizar Perfil Completo"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-500" />
                    <span>Visualizar</span>
                  </button>

                  {/* Editar Button */}
                  <button
                    onClick={() => setEditingStaff(user)}
                    disabled={!canManageTarget}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                      canManageTarget
                        ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                    }`}
                    title={canManageTarget ? 'Editar funcionário' : 'Apenas Owner pode editar administradores'}
                  >
                    {!canManageTarget ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Edit className="w-3.5 h-3.5" />}
                    <span>Editar</span>
                  </button>

                  {/* Excluir Button */}
                  <button
                    onClick={() => setDeletingStaff(user)}
                    disabled={!canManageTarget}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                      canManageTarget
                        ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                    }`}
                    title={canManageTarget ? 'Excluir funcionário' : 'Apenas Owner pode excluir administradores'}
                  >
                    {!canManageTarget ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AddStaffModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      <EditStaffModal
        isOpen={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
        staffUser={editingStaff}
      />

      <DeleteStaffModal
        isOpen={Boolean(deletingStaff)}
        onClose={() => setDeletingStaff(null)}
        staffUser={deletingStaff}
      />

      <ViewStaffProfileModal
        isOpen={Boolean(viewingStaff)}
        onClose={() => setViewingStaff(null)}
        staffUser={viewingStaff}
      />
    </div>
  );
};

export const StaffView = React.memo(StaffViewComponent);
