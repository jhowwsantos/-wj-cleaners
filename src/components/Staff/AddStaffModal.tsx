import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  MapPin,
  PoundSterling,
  CheckCircle2,
  Search,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { lookupPostcode } from '../../utils/postcodeLookup';
import { generateStaffEmail, generateSecurePassword } from '../../utils/staffCredentials';

interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ isOpen, onClose }) => {
  const { registerNewStaff, currentCompany, users, language } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '+44 7700 90000',
    password: '',
    role: 'CLEANER' as UserRole,
    homeAddress: '',
    homePostcode: 'SW1A 1AA',
    hourlyRate: 14,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [isSearchingPostcode, setIsSearchingPostcode] = useState(false);
  const [postcodeFeedback, setPostcodeFeedback] = useState('');

  // Credentials success modal state
  const [showCredentialsSuccess, setShowCredentialsSuccess] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | 'both' | null>(null);

  // Initialize secure 12-char password on modal open
  useEffect(() => {
    if (isOpen) {
      const initialPassword = generateSecurePassword(12);
      setFormData({
        name: '',
        email: '',
        phone: '+44 7700 90000',
        password: initialPassword,
        role: 'CLEANER',
        homeAddress: '',
        homePostcode: 'SW1A 1AA',
        hourlyRate: 14,
      });
      setErrorMsg('');
      setPostcodeFeedback('');
      setShowCredentialsSuccess(false);
      setCreatedCredentials(null);
      setCopiedField(null);
    }
  }, [isOpen]);

  // Handle Full Name input change with auto-generated Email
  const handleNameChange = (newName: string) => {
    const autoEmail = generateStaffEmail(newName, users, currentCompany.email);
    setFormData((prev) => ({
      ...prev,
      name: newName,
      email: autoEmail,
    }));
  };

  const handleRegeneratePassword = () => {
    const newPwd = generateSecurePassword(12);
    setFormData((prev) => ({ ...prev, password: newPwd }));
  };

  const handleCopy = (text: string, field: 'email' | 'password' | 'both') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Por favor, informe o Nome Completo do funcionário.');
      return;
    }

    if (!formData.email) {
      setErrorMsg('O e-mail automático não pôde ser gerado. Digite o Nome Completo.');
      return;
    }

    if (!formData.password || formData.password.length < 8) {
      setErrorMsg('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    const rateVal = Number(formData.hourlyRate);
    if (formData.role !== 'OWNER') {
      if (isNaN(rateVal) || rateVal <= 0) {
        setErrorMsg('O valor por hora deve ser maior que £0.00 para Limpadores e Administradores.');
        return;
      }
    } else {
      if (isNaN(rateVal) || rateVal < 0) {
        setErrorMsg('O valor por hora não pode ser negativo.');
        return;
      }
    }

    setIsLoading(true);

    try {
      await registerNewStaff({
        companyId: currentCompany.id,
        name: formData.name.trim(),
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
        homeAddress: formData.homeAddress,
        homePostcode: formData.homePostcode,
        active: true,
        hourlyRate: Number(formData.hourlyRate),
        mustChangePassword: true,
      });

      // Show Credentials Screen
      setCreatedCredentials({
        name: formData.name.trim(),
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      setShowCredentialsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao cadastrar funcionário.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SUCCESS SCREEN WITH GENERATED CREDENTIALS & COPY BUTTONS
  // -------------------------------------------------------------
  if (showCredentialsSuccess && createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-6 my-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-black text-xl text-slate-900 dark:text-white">
              Funcionário Cadastrado!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Credenciais de acesso para <strong>{createdCredentials.name}</strong>.
            </p>
          </div>

          {/* Credentials Cards */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-900/70 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            {/* Email */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  E-mail de Login
                </span>
                {copiedField === 'email' && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copiado!
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-xs text-slate-900 dark:text-white select-all truncate mr-2">
                  {createdCredentials.email}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdCredentials.email, 'email')}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Senha Inicial (12 Caracteres)
                </span>
                {copiedField === 'password' && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Copiado!
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-mono font-bold text-xs text-slate-900 dark:text-white select-all tracking-wider truncate mr-2">
                  {createdCredentials.password}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(createdCredentials.password, 'password')}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-lg flex items-center gap-1 transition-all cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </button>
              </div>
            </div>
          </div>

          {/* Copy Both Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                const combinedText = `W&J Cleaners UK - Credenciais de Acesso:\nE-mail: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`;
                handleCopy(combinedText, 'both');
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {copiedField === 'both' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>E-mail e Senha Copiados Juntos!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar E-mail e Senha Juntos</span>
                </>
              )}
            </button>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Troca Obrigatória:</strong> No primeiro acesso, o funcionário deverá obrigatoriamente alterar esta senha antes de usar o sistema.
              </span>
            </div>
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={() => {
              setShowCredentialsSuccess(false);
              setCreatedCredentials(null);
              onClose();
            }}
            className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                {getTranslation(language, 'addStaffTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {getTranslation(language, 'addStaffSub')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'fullNameLabel')} *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Ana Souza"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{getTranslation(language, 'autoGeneratedEmailLabel')} *</span>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                  @wjcleaners.co.uk
                </span>
              </label>
              <div className="relative mt-1">
                <input
                  type="email"
                  readOnly
                  required
                  placeholder="firstname.lastname@wjcleaners.co.uk"
                  value={formData.email}
                  className="w-full p-2.5 pr-8 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none cursor-not-allowed select-all"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'phone')} *
              </label>
              <input
                type="text"
                required
                placeholder="+44 7700 900000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{getTranslation(language, 'initialPasswordLabel')} *</span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  12 chars
                </span>
              </label>
              <div className="relative mt-1 flex items-center">
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 pr-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleRegeneratePassword}
                  className="absolute right-1.5 px-2.5 py-1 text-[10px] font-bold bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  {getTranslation(language, 'generateBtn')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'rolePermissionLabel')} *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CLEANER">{getTranslation(language, 'cleanerRoleOpt')}</option>
                <option value="ADMINISTRATOR">{getTranslation(language, 'adminRoleOpt')}</option>
                <option value="OWNER">{getTranslation(language, 'ownerRoleOpt')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {getTranslation(language, 'baseAddressLabel')}
              </label>
              <input
                type="text"
                placeholder="Ex: 22 High Street, London"
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

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {getTranslation(language, 'hourlyRateLabel')}
            </label>
            <input
              type="number"
              step="0.5"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: Number(e.target.value) })}
              className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
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
                  {getTranslation(language, 'registerStaffBtn')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

