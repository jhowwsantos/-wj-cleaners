import React, { useState, useEffect } from 'react';
import { X, UserCheck, Mail, Phone, Lock, Shield, MapPin, PoundSterling, CheckCircle2, Image, Key, Search, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { lookupPostcode } from '../../utils/postcodeLookup';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: User | null;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200',
];

export const EditStaffModal: React.FC<EditStaffModalProps> = ({ isOpen, onClose, staffUser }) => {
  const { updateUser, currentUser } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'CLEANER' as UserRole,
    homeAddress: '',
    homePostcode: '',
    hourlyRate: 14,
    active: true,
    avatarUrl: '',
    newPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isSearchingPostcode, setIsSearchingPostcode] = useState(false);
  const [postcodeFeedback, setPostcodeFeedback] = useState('');

  const handlePostcodeLookup = async (code: string) => {
    if (!code || code.trim().length < 2) return;
    setIsSearchingPostcode(true);
    setPostcodeFeedback('');
    const res = await lookupPostcode(code);
    setIsSearchingPostcode(false);
    if (res) {
      const full = res.fullAddress || res.addressSummary;
      setPostcodeFeedback(full);
      setFormData((prev) => {
        const current = prev.homeAddress.trim();
        // If address is empty or contains administrative-only text like unparished area
        if (!current || current.toLowerCase().includes('unparished') || current.split(',').length <= 1) {
          return {
            ...prev,
            homeAddress: full,
            homePostcode: res.postcode || prev.homePostcode,
          };
        }
        return prev;
      });
    } else {
      setPostcodeFeedback('Postcode não encontrado no Reino Unido.');
    }
  };

  useEffect(() => {
    if (staffUser) {
      setFormData({
        name: staffUser.name || '',
        email: staffUser.email || '',
        phone: staffUser.phone || '',
        role: staffUser.role || 'CLEANER',
        homeAddress: staffUser.homeAddress || '',
        homePostcode: staffUser.homePostcode || '',
        hourlyRate: staffUser.hourlyRate || 14,
        active: staffUser.active !== false,
        avatarUrl: staffUser.avatarUrl || AVATAR_PRESETS[0],
        newPassword: '',
      });
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [staffUser, isOpen]);

  if (!isOpen || !staffUser) return null;

  const isOwner = currentUser.role === 'OWNER';
  const isAdmin = currentUser.role === 'ADMINISTRATOR';

  // Can currentUser edit role? Only OWNER can change roles or edit other admins/owners
  const canEditRole = isOwner;
  const isTargetOwnerOrAdmin = staffUser.role === 'OWNER' || staffUser.role === 'ADMINISTRATOR';

  if (isAdmin && isTargetOwnerOrAdmin && staffUser.id !== currentUser.id) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full text-center space-y-4 border border-slate-200 dark:border-slate-700">
          <Shield className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Acesso Restrito</h3>
          <p className="text-xs text-slate-500">
            Apenas o Proprietário (Owner) pode alterar permissões e dados de Administradores.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-700 rounded-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (!formData.name.trim() || !formData.email.trim()) {
        setErrorMsg('Por favor, preencha nome e e-mail.');
        setIsLoading(false);
        return;
      }

      const updates: Partial<User> = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        role: formData.role,
        homeAddress: formData.homeAddress,
        homePostcode: formData.homePostcode,
        hourlyRate: Number(formData.hourlyRate),
        active: formData.active,
        avatarUrl: formData.avatarUrl,
      };

      if (formData.newPassword.trim()) {
        if (formData.newPassword.trim().length < 6) {
          setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
          setIsLoading(false);
          return;
        }
        updates.password = formData.newPassword.trim();
      }

      updateUser(staffUser.id, updates);
      setSuccessMsg('Dados atualizados com sucesso!');

      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao atualizar funcionário.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                Editar Funcionário
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Altere permissões, valores por hora, cargo ou redefina a senha.
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

        {/* Alerts */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Avatar Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Image className="w-3.5 h-3.5 text-blue-500" /> Foto do Perfil
            </label>
            <div className="flex items-center gap-3">
              <img
                src={formData.avatarUrl || AVATAR_PRESETS[0]}
                alt="Preview"
                className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500/40 shrink-0"
              />
              <div className="flex-1 space-y-1.5">
                <input
                  type="url"
                  placeholder="URL da foto de perfil..."
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatarUrl: preset })}
                      className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all ${
                        formData.avatarUrl === preset ? 'border-blue-600 scale-110' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={preset} alt="preset" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Name & Active Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Status *
              </label>
              <select
                value={formData.active ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                E-mail de Acesso *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Telefone *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Role & Hourly Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Cargo / Permissão</span>
                {!canEditRole && <span className="text-[10px] text-amber-500 font-semibold">(Apenas Owner altera)</span>}
              </label>
              <select
                disabled={!canEditRole}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none disabled:opacity-60"
              >
                <option value="CLEANER">Funcionário (Cleaner)</option>
                <option value="ADMINISTRATOR">Administrador</option>
                <option value="OWNER">Proprietário (Owner)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Valor Hora (£/h)
              </label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">£</span>
                <input
                  type="number"
                  step="0.5"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
                  className="w-full p-2.5 pl-7 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Postcode & Address */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Endereço Base
              </label>
              <input
                type="text"
                placeholder="Ex: 45 Battersea Park Rd, London"
                value={formData.homeAddress}
                onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Postcode UK</span>
                {isSearchingPostcode && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="Ex: KT9 1BH"
                  value={formData.homePostcode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setFormData({ ...formData, homePostcode: val });
                    if (val.trim().length >= 3) {
                      handlePostcodeLookup(val);
                    }
                  }}
                  onBlur={() => {
                    if (formData.homePostcode.trim().length >= 2) {
                      handlePostcodeLookup(formData.homePostcode);
                    }
                  }}
                  className="w-full p-2.5 pr-8 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handlePostcodeLookup(formData.homePostcode)}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                  title="Buscar endereço automático pelo Postcode"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Postcode Auto-fill feedback badge */}
          {postcodeFeedback && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="truncate">
                  Endereço localizado: <strong>{postcodeFeedback}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    homeAddress: postcodeFeedback,
                  }))
                }
                className="px-2.5 py-1 bg-blue-600 text-white font-extrabold rounded-lg text-[10px] hover:bg-blue-700 shrink-0 transition-all cursor-pointer"
              >
                Preencher Endereço
              </button>
            </div>
          )}

          {/* Reset Password Optional */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" /> Redefinir Senha (Opcional)
            </label>
            <input
              type="password"
              placeholder="Digite nova senha caso deseje redefinir (mín. 6 chars)"
              value={formData.newPassword}
              onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2.5 text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
