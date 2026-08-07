import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import { Building2, Mail, ArrowRight, AlertCircle, KeyRound, Globe, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';

interface AccessPortalLoginViewProps {
  onSwitchToWJPortal?: () => void;
}

export const AccessPortalLoginView: React.FC<AccessPortalLoginViewProps> = ({ onSwitchToWJPortal }) => {
  const { loginWithEmailPassword, language, setLanguage } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await loginWithEmailPassword(email, password, rememberMe);
    } catch (err: any) {
      setErrorMessage(
        err?.message || (language === 'pt' ? 'Erro ao efetuar login.' : 'Error signing in.')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const titleText = language === 'pt' ? 'Portal de Acesso' : 'Access Portal';
  const subtitleText =
    language === 'pt'
      ? 'Acesse a sua conta empresarial na plataforma'
      : 'Sign in to your business management account';

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-y-auto py-8 font-sans">
      {/* Neutral Ambient Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-slate-800/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-zinc-800/30 rounded-full blur-3xl pointer-events-none" />

      {/* Language Toggle in Top Corner */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
          className="p-2 text-xs font-bold text-slate-300 bg-slate-900/90 hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-800 shadow-sm cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>{language.toUpperCase()}</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-slate-800/90 p-8 shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Neutral Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-1">
            <img
              src={logoImg || '/logo.png'}
              alt="Logo"
              className="w-24 h-24 object-contain mx-auto drop-shadow-lg p-1"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = '/logo.png';
              }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              {titleText}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {subtitleText}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-red-950/80 border border-red-800/80 rounded-2xl flex items-start gap-2 text-xs text-red-200 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {getTranslation(language, 'emailLabel')} *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-slate-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {getTranslation(language, 'passwordLabel')} *
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs font-semibold text-white placeholder-slate-600 outline-none focus:ring-2 focus:ring-slate-500 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer select-none hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-800 bg-slate-950/90 text-slate-100 focus:ring-2 focus:ring-slate-500 accent-slate-400 cursor-pointer"
              />
              <span>{language === 'pt' ? 'Permanecer conectado' : 'Remember me'}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-slate-100 hover:bg-white text-slate-900 font-extrabold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-900 border-t-transparent" />
            ) : (
              <>
                <span>{getTranslation(language, 'loginBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer & Portal Switch Option */}
        <div className="pt-2 border-t border-slate-800/80 space-y-3 text-center">
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-600" />
            <span>
              {language === 'pt'
                ? 'Autenticação segura e criptografada via Firestore & Auth.'
                : 'Secure encrypted authentication via Firestore & Auth.'}
            </span>
          </div>

          {onSwitchToWJPortal && (
            <button
              type="button"
              onClick={onSwitchToWJPortal}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 underline underline-offset-4 transition-colors cursor-pointer"
            >
              {language === 'pt' ? 'Ir para Portal W & J Cleaners' : 'Go to W & J Cleaners Portal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
