import React, { useMemo } from 'react';
import logoImg from '../assets/logo.png';
import {
  LayoutDashboard,
  Calendar,
  Navigation,
  Users,
  UserCheck,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Building2,
  Smartphone,
  Shield,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const SidebarComponent: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeTab, setActiveTab, userRole, language, currentUser } = useApp();

  const filteredNav = useMemo(() => {
    const navItems = [
      { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['OWNER', 'ADMINISTRATOR'] },
      { id: 'cleaner_hub', labelKey: 'cleanerHubTitle', icon: Smartphone, roles: ['OWNER', 'ADMINISTRATOR', 'CLEANER'], highlight: true },
      { id: 'schedule', labelKey: 'schedule', icon: Calendar, roles: ['OWNER', 'ADMINISTRATOR', 'CLEANER'] },
      { id: 'route', labelKey: 'routeOptimizer', icon: Navigation, roles: ['OWNER', 'ADMINISTRATOR'] },
      { id: 'clients', labelKey: 'clients', icon: Users, roles: ['OWNER', 'ADMINISTRATOR', 'CLEANER'] },
      { id: 'financials', labelKey: 'financials', icon: TrendingUp, roles: ['OWNER', 'ADMINISTRATOR'] },
      { id: 'reports', labelKey: 'reports', icon: FileSpreadsheet, roles: ['OWNER', 'ADMINISTRATOR'] },
      { id: 'cleaners', labelKey: 'cleaners', icon: UserCheck, roles: ['OWNER', 'ADMINISTRATOR'] },
      { id: 'saas', labelKey: 'saasAdmin', icon: Building2, roles: ['OWNER'] },
    ];
    return navItems.filter((item) => item.roles.includes(userRole));
  }, [userRole]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 flex items-center justify-between lg:hidden border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <img
              src={logoImg || '/logo.png'}
              alt="W & J Logo"
              className="w-6 h-6 aspect-square object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = '/logo.png';
              }}
            />
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">W & J Cleaners</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
          <img
            src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'}
            alt={currentUser.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/30"
          />
          <div className="overflow-hidden">
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
              <Shield className="w-3 h-3 inline" /> {currentUser.role}
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1.5 overflow-y-auto">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                    : item.highlight
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{getTranslation(language, item.labelKey as any)}</span>
              </button>
            );
          })}
        </nav>

        {/* UK Cleaners Badge Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <img
              src={logoImg || '/logo.png'}
              alt="W & J Logo"
              className="w-6 h-6 aspect-square object-contain shrink-0"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = '/logo.png';
              }}
            />
            <span className="font-bold text-xs text-slate-700 dark:text-slate-300">W & J Cleaners</span>
          </div>
          <div className="text-[10px] text-slate-400">Clean Spaces, Better Places</div>
        </div>
      </aside>
    </>
  );
};

export const Sidebar = React.memo(SidebarComponent);
