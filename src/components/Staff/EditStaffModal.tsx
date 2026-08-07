import React, { useState, useEffect, useRef } from 'react';
import { X, UserCheck, Mail, Phone, Lock, Shield, MapPin, PoundSterling, CheckCircle2, Image, Key, Search, Loader2, Camera, Upload } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { User, UserRole } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { lookupPostcode } from '../../utils/postcodeLookup';
import { processAndUploadAvatar, AVATAR_PRESETS } from '../../utils/avatarUpload';

interface EditStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: User | null;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({ isOpen, onClose, staffUser }) => {
  const { updateUser, currentUser, language } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isSearchingPostcode, setIsSearchingPostcode] = useState(false);
  const [postcodeFeedback, setPostcodeFeedback] = useState('');

  const handleAvatarFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !staffUser) return;

    setIsUploadingAvatar(true);
    setErrorMsg('');
    try {
      const finalUrl = await processAndUploadAvatar(file, staffUser.id, (preview) => {
        setFormData((prev) => ({ ...prev, avatarUrl: preview }));
      });
      setFormData((prev) => ({ ...prev, avatarUrl: finalUrl }));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar imagem.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
        hourlyRate: staffUser.hourlyRate !== undefined && staffUser.hourlyRate !== null ? Number(staffUser.hourlyRate) : (staffUser.role === 'OWNER' ? 0 : 14),
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

      const rateVal = Number(formData.hourlyRate);
      if (formData.role !== 'OWNER') {
        if (isNaN(rateVal) || rateVal <= 0) {
          setErrorMsg('O valor por hora deve ser maior que £0.00 para Limpadores e Administradores.');
          setIsLoading(false);
          return;
        }
      } else {
        if (isNaN(rateVal) || rateVal < 0) {
          setErrorMsg('O valor por hora não pode ser negativo.');
          setIsLoading(false);
          return;
        }
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
                {getTranslation(language, 'editStaffModalTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getTranslation(language, 'editStaffModalSub')}
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
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-blue-500" />
                <span>{language === 'pt' ? 'Foto de Perfil' : 'Profile Photo'}</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
                <span>{language === 'pt' ? 'Upload / Tirar Foto' : 'Upload / Take Photo'}</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileUpload}
            />

            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
              <div
                className="relative group cursor-pointer shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title={language === 'pt' ? 'Clique para carregar foto do dispositivo' : 'Click to upload photo from device'}
              >
                <img
                  src={formData.avatarUrl || AVATAR_PRESETS[0]}
                  alt="Preview"
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/40"
                />
                <div className="absolute inset-0 rounded-full bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'pt' ? 'Carregando...' : 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{language === 'pt' ? 'Escolher Foto do Dispositivo' : 'Choose Photo from Device'}</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {language === 'pt' ? 'Galeria, Câmera ou Arquivos' : 'Gallery, Camera or Files'}
                </p>
              </div>
            </div>
          </div>

          {/* Name & Active Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'fullNameLabel')} *
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
                {getTranslation(language, 'statusStaffLabel')} *
              </label>
              <select
                value={formData.active ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, active: e.target.value === 'true' })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="true">{getTranslation(language, 'active')}</option>
                <option value="false">{getTranslation(language, 'inactive')}</option>
              </select>
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'accessEmailLabel')} *
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
                {getTranslation(language, 'phone')} *
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
                <span>{getTranslation(language, 'rolePermissionLabel')}</span>
                {!canEditRole && <span className="text-[10px] text-amber-500 font-semibold">(Owner only)</span>}
              </label>
              <select
                disabled={!canEditRole}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none disabled:opacity-60"
              >
                <option value="CLEANER">{getTranslation(language, 'cleanerRoleOpt')}</option>
                <option value="ADMINISTRATOR">{getTranslation(language, 'adminRoleOpt')}</option>
                <option value="OWNER">{getTranslation(language, 'ownerRoleOpt')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'hourlyRateLabel')}
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
                {getTranslation(language, 'baseAddressLabel')}
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
                <span>{getTranslation(language, 'postcode')}</span>
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
                  {getTranslation(language, 'addressFound')}: <strong>{postcodeFeedback}</strong>
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
                {getTranslation(language, 'fillAddressBtn')}
              </button>
            </div>
          )}

          {/* Reset Password Optional */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-500" /> {getTranslation(language, 'resetPasswordOpt')}
            </label>
            <input
              type="password"
              placeholder="Ex: ******"
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
              {getTranslation(language, 'cancel')}
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
                  {getTranslation(language, 'saveChangesBtn')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
