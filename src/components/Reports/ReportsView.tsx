import React from 'react';
import {
  FileSpreadsheet,
  Download,
  FileText,
  Printer,
  CheckCircle2,
  TrendingUp,
  Building2,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { exportClientsCSV, exportJobsCSV, exportFinancialsCSV } from '../../utils/exportUtils';

const ReportsViewComponent: React.FC = () => {
  const { currentCompany, clients, jobs, expenses, users, language, userRole } = useApp();

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
          {getTranslation(language, 'reportsRestrictedDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {getTranslation(language, 'reports')} & {getTranslation(language, 'dataExport')}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {getTranslation(language, 'reportsSub')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Clients Roster Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 w-fit bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {getTranslation(language, 'clientCrmDatabase')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {getTranslation(language, 'clientCrmSub')}
            </p>
          </div>
          <button
            onClick={() => exportClientsCSV(currentCompany, clients)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> {getTranslation(language, 'downloadClientsCsv')}
          </button>
        </div>

        {/* Cleaning Jobs Schedule Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 w-fit bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {getTranslation(language, 'completedJobsInvoices')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {getTranslation(language, 'completedJobsSub')}
            </p>
          </div>
          <button
            onClick={() => exportJobsCSV(currentCompany, jobs)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> {getTranslation(language, 'downloadJobsCsv')}
          </button>
        </div>

        {/* Financial P&L Statement Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 w-fit bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              {getTranslation(language, 'fullPandlSummary')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {getTranslation(language, 'fullPandlSub')}
            </p>
          </div>
          <button
            onClick={() => exportFinancialsCSV(currentCompany, jobs, expenses, users)}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" /> {getTranslation(language, 'downloadPandlCsv')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReportsView = React.memo(ReportsViewComponent);
