import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import {
  Sparkles,
  Building2,
  UserCheck,
  Globe,
  Sun,
  Moon,
  Bell,
  Menu,
  Shield,
  Briefcase,
  User,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';
import { SaaSAdminModal } from './SaaSAdminModal';

interface NavbarProps {
  onToggleSidebar: () => void;
}

const NavbarComponent: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const {
    currentCompany,
    currentUser,
    logout,
    language,
    setLanguage,
    theme,
    setTheme,
    notifications,
    markNotificationRead,
  } = useApp();

  const [isSaaSModalOpen, setIsSaaSModalOpen] = useState(false);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
          {/* Left: Mobile Toggle & Brand Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <img
                src={currentCompany?.logoUrl && (currentCompany.logoUrl.startsWith('http://') || currentCompany.logoUrl.startsWith('https://') || currentCompany.logoUrl.startsWith('data:') || currentCompany.logoUrl.startsWith('/')) ? currentCompany.logoUrl : logoImg}
                alt="W & J Cleaners"
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.onerror = null;
                  target.src = logoImg || '/logo.png';
                }}
              />
              <div className="shrink-0 min-w-0">
                <h1 className="font-extrabold text-xs sm:text-lg leading-tight text-slate-900 dark:text-white tracking-tight flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                  <span>W & J Cleaners</span>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 sm:px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800 shrink-0">
                    UK
                  </span>
                </h1>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 hidden sm:block">
                  {getTranslation(language, 'appTagline')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* SaaS Branch Switcher Button (Owner Only) */}
            {currentUser.role === 'OWNER' && (
              <button
                onClick={() => setIsSaaSModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="max-w-[110px] truncate">{currentCompany.name}</span>
              </button>
            )}

            {/* User Profile Badge */}
            <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-semibold bg-blue-50/80 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 rounded-xl border border-blue-200 dark:border-blue-800 shrink-0">
              {currentUser.role === 'OWNER' ? (
                <Shield className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : currentUser.role === 'ADMINISTRATOR' ? (
                <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              ) : (
                <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span className="hidden md:inline font-extrabold">{currentUser.name}</span>
              <span className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded font-black uppercase bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 shrink-0">
                {currentUser.role}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 rounded-xl border border-red-200 dark:border-red-900 transition-colors flex items-center gap-1.5"
              title="Sair do Sistema"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            {/* Language Toggle (EN / PT) */}
            <button
              onClick={() => setLanguage(language === 'en' ? 'pt' : 'en')}
              className="p-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{language.toUpperCase()}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              title="Toggle Theme Mode"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotifDropdownOpen(!isNotifDropdownOpen)}
                className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {isNotifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 pb-2 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs font-bold text-slate-800 dark:text-slate-100">
                    <span>{getTranslation(language, 'notifications')}</span>
                    <span className="text-[10px] text-blue-600 font-semibold">{unreadNotifs} {getTranslation(language, 'unread')}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">{getTranslation(language, 'noNotifications')}</div>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => markNotificationRead(n.id)}
                          className={`p-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                            !n.read ? 'bg-blue-50/40 dark:bg-blue-950/20 font-medium' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex justify-between">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{n.timestamp}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* SaaS Admin Modal */}
      <SaaSAdminModal isOpen={isSaaSModalOpen} onClose={() => setIsSaaSModalOpen(false)} />
    </>
  );
};

export const Navbar = React.memo(NavbarComponent);
