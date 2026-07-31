import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import logoImg from '../assets/logo.png';

export const ForcePasswordChangeModal: React.FC = () => {
  const { currentUser, updateUser, addNotification } = useApp();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!currentUser || !currentUser.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('A confirmação de senha não coincide com a nova senha.');
      return;
    }

    if (currentUser.password && newPassword === currentUser.password) {
      setErrorMsg('A nova senha não pode ser igual à senha provisória inicial.');
      return;
    }

    setIsLoading(true);

    try {
      await updateUser(currentUser.id, {
        password: newPassword,
        mustChangePassword: false,
      });

      addNotification(
        'Senha Atualizada!',
        'Sua nova senha foi salva com sucesso. Você já pode utilizar o sistema com total segurança.',
        'SUCCESS'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-slate-700 p-6 space-y-6 my-8 text-white relative">
        {/* Brand/Security Header */}
        <div className="text-center space-y-2">
          <img
            src={logoImg || '/logo.png'}
            alt="W & J Cleaners Logo"
            className="w-16 h-16 aspect-square object-contain mx-auto"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.onerror = null;
              target.src = '/logo.png';
            }}
          />
          <h2 className="text-xl font-black tracking-tight text-white">
            Primeiro Acesso: Troca de Senha
          </h2>
          <p className="text-xs text-slate-400">
            Olá <strong>{currentUser.name}</strong> ({currentUser.email}). Por motivos de segurança, altere sua senha inicial provisória para continuar.
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-red-950/80 border border-red-800 rounded-2xl flex items-start gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Requirements Checklist */}
        <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-1.5 text-xs text-slate-300">
          <div className="font-bold text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-400" /> Requisitos da Nova Senha:
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={newPassword.length >= 8 ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              ✓ Mínimo de 8 caracteres
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={newPassword && confirmPassword && newPassword === confirmPassword ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              ✓ Senhas devem ser idênticas
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nova Senha Pessoal *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Confirmar Nova Senha *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar Nova Senha e Acessar Sistema
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
