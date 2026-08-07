import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  Receipt,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { PayrollView } from './PayrollView';
import { ExpensesView } from './ExpensesView';

const FinancialsViewComponent: React.FC = () => {
  const { language, userRole } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'payroll'>('expenses');

  if (userRole === 'CLEANER') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-amber-200 dark:border-amber-900/50 shadow-sm max-w-2xl mx-auto text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          {getTranslation(language, 'restrictedAccess')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {getTranslation(language, 'financialsRestrictedDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-fit">
        <button
          onClick={() => setActiveSubTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'expenses'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          {language === 'pt' ? 'Despesas Operacionais' : 'Operating Expenses'}
        </button>

        <button
          onClick={() => setActiveSubTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === 'payroll'
              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          {language === 'pt' ? 'Folha de Pagamento' : 'Payroll'}
        </button>
      </div>

      {activeSubTab === 'expenses' ? (
        <ExpensesView />
      ) : (
        <PayrollView />
      )}
    </div>
  );
};

export const FinancialsView = React.memo(FinancialsViewComponent);
