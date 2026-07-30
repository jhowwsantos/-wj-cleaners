import React, { useState, useMemo } from 'react';
import {
  PoundSterling,
  TrendingUp,
  Plus,
  FileSpreadsheet,
  Calendar,
  AlertCircle,
  BarChart2,
  PieChart as PieChartIcon,
  X,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { useApp } from '../../context/AppContext';
import { Expense } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { exportFinancialsCSV } from '../../utils/exportUtils';

const FinancialsViewComponent: React.FC = () => {
  const { jobs, expenses, addExpense, currentCompany, language, userRole } = useApp();

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [category, setCategory] = useState<Expense['category']>('FUEL');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(45);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const totalRevenue = useMemo(() => jobs.reduce((acc, j) => acc + (j.price || 0), 0), [jobs]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const netProfit = useMemo(() => totalRevenue - totalExpenses, [totalRevenue, totalExpenses]);

  if (userRole === 'CLEANER') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-amber-200 dark:border-amber-900/50 shadow-sm max-w-2xl mx-auto text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          Acesso Restrito
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Apenas Administradores e Owners possuem permissão para visualizar o faturamento, despesas e relatórios financeiros da empresa.
        </p>
      </div>
    );
  }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      category,
      description,
      amount: Number(amount),
      date: todayStr,
      createdBy: 'Manager',
    });
    setIsAddExpenseOpen(false);
    setDescription('');
  };

  const monthlyChartData = [
    { month: 'Jan', revenue: 4200, expenses: 1800, profit: 2400 },
    { month: 'Feb', revenue: 5100, expenses: 2100, profit: 3000 },
    { month: 'Mar', revenue: 4800, expenses: 1950, profit: 2850 },
    { month: 'Apr', revenue: 6300, expenses: 2400, profit: 3900 },
    { month: 'May', revenue: 5900, expenses: 2200, profit: 3700 },
    { month: 'Jun', revenue: 7100, expenses: 2700, profit: 4400 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {getTranslation(language, 'financialsTitle')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time UK business revenue, cleaner payroll estimation, expenses, and net profit.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportFinancialsCSV(currentCompany, jobs, expenses)}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export Financials CSV
          </button>
          <button
            onClick={() => setIsAddExpenseOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> {getTranslation(language, 'addExpense')}
          </button>
        </div>
      </div>

      {/* Top Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">Total Revenue</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            £{totalRevenue.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">From completed cleanings</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">Total Operating Expenses</span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            £{totalExpenses.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Fuel, Wages, Equipment</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <span className="text-xs text-slate-500 font-bold uppercase">Net Profit Margin</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            £{netProfit.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            ~{totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0}% Profitability
          </div>
        </div>
      </div>

      {/* Chart & Expense Log Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Breakdown Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
            Monthly Financial Growth (£)
          </h3>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" fill="#10b981" name="Net Profit" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Recent Expenses
            </h3>
            <span className="text-xs font-semibold text-slate-400">{expenses.length} Logged</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{exp.description || exp.category}</div>
                  <div className="text-[10px] text-slate-400">{exp.date} • {exp.category}</div>
                </div>
                <div className="font-black text-red-600">-£{exp.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                Log Business Expense
              </h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  <option value="FUEL">Fuel</option>
                  <option value="PRODUCTS">Cleaning Products</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="WAGES">Wages / Payroll</option>
                  <option value="PARKING">Parking / Congestion Charge</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fuel at BP Station London"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Amount (£)</label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const FinancialsView = React.memo(FinancialsViewComponent);
