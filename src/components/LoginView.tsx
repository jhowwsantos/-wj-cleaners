import React, { useState } from 'react';
import { Sparkles, Mail, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginView: React.FC = () => {
  const { loginWithEmailPassword } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      await loginWithEmailPassword(email, password);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao efetuar login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-800/90 backdrop-blur-xl rounded-3xl border border-slate-700/80 p-8 shadow-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="W & J Cleaners Logo"
            className="w-16 h-16 object-contain rounded-2xl mx-auto shadow-lg shadow-blue-500/20 bg-white/5 p-1 border border-slate-700/50"
            referrerPolicy="no-referrer"
          />
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            W & J Cleaners <span className="text-xs bg-blue-900/80 text-blue-300 font-bold px-2 py-0.5 rounded-md border border-blue-700">UK</span>
          </h1>
          <p className="text-xs text-slate-400">
            Acesse sua conta para gerenciar agendamentos, clientes e equipe.
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
              E-mail de Acesso *
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
              Senha *
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-[10px] text-slate-500 text-center leading-relaxed">
          Autenticação criptografada com controle de acesso em tempo real via Firebase Authentication & Firestore.
        </div>
      </div>
    </div>
  );
};
