import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo.png';
import { Mail, ArrowRight, AlertCircle, KeyRound, Globe, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';
import { CompanyLogo } from './CompanyLogo';
import { AccessPortalLoginView } from './AccessPortalLoginView';

export const LoginView: React.FC = () => {
  const { loginWithEmailPassword, language, setLanguage, currentCompany } = useApp();

  const [portalMode, setPortalMode] = useState<'wj' | 'access'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const hostname = window.location.hostname.toLowerCase();
      if (
        search.includes('portal') ||
        search.includes('access') ||
        search.includes('p=access') ||
        search.includes('p=1') ||
        hash.includes('portal') ||
        hash.includes('access') ||
        hostname.startsWith('app.') ||
        hostname.startsWith('portal.')
      ) {
        return 'access';
      }
    }
    return 'wj';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const togglePortalMode = (mode: 'wj' | 'access') => {
    setPortalMode(mode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await loginWithEmailPassword(email, password, rememberMe);
    } catch (err: any) {
      setErrorMessage(err?.message || (language === 'pt' ? 'Erro ao efetuar login.' : 'Error signing in.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (portalMode === 'access') {
    return <AccessPortalLoginView onSwitchToWJPortal={() => togglePortalMode('wj')} />;
  }

  return (
    <div className="min-h-dvh bg-slate-900 flex items-center justify-center p-4 relative overflow-y-auto py-8">
      {/* Background Glow Accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Language Toggle in Top Corner */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
          className="p-2 text-xs font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>{language.toUpperCase()}</span>
        </button>
      </div>

      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl rounded-3xl border border-slate-700/80 p-8 shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <img
              src={logoImg || '/logo.png'}
              alt="W & J Cleaners Logo"
              className="w-28 h-28 object-contain mx-auto drop-shadow-lg p-1"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = '/logo.png';
              }}
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <span>W & J Cleaners</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md border text-white bg-blue-900/80 border-blue-600/80 shadow-xs">
              UK
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            {getTranslation(language, 'loginSub')}
          </p>
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
                placeholder="seu.email@wjcleaners.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer select-none hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900/90 text-blue-600 focus:ring-2 focus:ring-blue-500 accent-blue-600 cursor-pointer"
              />
              <span>{language === 'pt' ? 'Permanecer conectado' : 'Remember me'}</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{getTranslation(language, 'loginBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-700/80 space-y-3 text-center">
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-600" />
            <span>
              {language === 'pt'
                ? 'Autenticação criptografada com controle de acesso em tempo real via Firebase Authentication & Firestore.'
                : 'Encrypted authentication with real-time access control via Firebase Authentication & Firestore.'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => togglePortalMode('access')}
            className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 transition-colors cursor-pointer"
          >
            {language === 'pt' ? 'Ir para Portal de Acesso (Outras Empresas)' : 'Go to Access Portal (Client Companies)'}
          </button>
        </div>
      </div>
    </div>
  );
};

