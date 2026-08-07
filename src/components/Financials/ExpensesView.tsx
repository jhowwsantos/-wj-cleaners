import React, { useState, useMemo } from 'react';
import {
  Fuel,
  Wallet,
  Sparkles,
  Wrench,
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Pencil,
  Trash2,
  PieChart as PieChartIcon,
  TrendingUp,
  BarChart2,
  PoundSterling,
  X,
  ShieldAlert,
  CreditCard,
  Building2,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { Expense } from '../../types';
import { calculateCompanyFinancials } from '../../utils/financialCalculations';
import { exportFinancialsCSV } from '../../utils/exportUtils';

export const CATEGORIES = [
  {
    id: 'Combustível',
    label: 'Combustível',
    icon: Fuel,
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-300 dark:border-amber-800',
    hex: '#f59e0b',
  },
  {
    id: 'Salários',
    label: 'Salários',
    icon: Wallet,
    badgeBg: 'bg-purple-100 dark:bg-purple-950/80',
    badgeText: 'text-purple-800 dark:text-purple-300',
    badgeBorder: 'border-purple-300 dark:border-purple-800',
    hex: '#a855f7',
  },
  {
    id: 'Produtos de Limpeza',
    label: 'Produtos de Limpeza',
    icon: Sparkles,
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80',
    badgeText: 'text-blue-800 dark:text-blue-300',
    badgeBorder: 'border-blue-300 dark:border-blue-800',
    hex: '#3b82f6',
  },
  {
    id: 'Equipamentos',
    label: 'Equipamentos',
    icon: Wrench,
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-800 dark:text-emerald-300',
    badgeBorder: 'border-emerald-300 dark:border-emerald-800',
    hex: '#10b981',
  },
  {
    id: 'Outros',
    label: 'Outros',
    icon: Receipt,
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-800 dark:text-slate-300',
    badgeBorder: 'border-slate-300 dark:border-slate-700',
    hex: '#64748b',
  },
] as const;

export function normalizeCategory(cat: string): string {
  if (!cat) return 'Outros';
  const c = cat.trim().toUpperCase();
  if (c === 'FUEL' || c === 'COMBUSTÍVEL' || c === 'COMBUSTIVEL') return 'Combustível';
  if (c === 'WAGES' || c === 'SALÁRIOS' || c === 'SALARIOS' || c === 'PAYROLL') return 'Salários';
  if (c === 'PRODUCTS' || c === 'PRODUTOS DE LIMPEZA' || c === 'PRODUTOS' || c === 'PRODUTO') return 'Produtos de Limpeza';
  if (c === 'EQUIPMENT' || c === 'EQUIPAMENTOS' || c === 'EQUIPAMENTO') return 'Equipamentos';
  return 'Outros';
}

export function getCategoryInfo(cat: string) {
  const norm = normalizeCategory(cat);
  return CATEGORIES.find((c) => c.id === norm) || CATEGORIES[4];
}

export const PAYMENT_METHODS = [
  { id: 'CARD', label: 'Cartão de Crédito/Débito' },
  { id: 'TRANSFER', label: 'Transferência / PIX / Bank' },
  { id: 'CASH', label: 'Dinheiro (Espécie)' },
  { id: 'OTHER', label: 'Outro' },
] as const;

export function getPaymentMethodLabel(pm?: string): string {
  if (!pm) return 'N/I';
  const upper = pm.toUpperCase();
  if (upper === 'CARD' || upper === 'CARTÃO' || upper === 'CARTAO') return 'Cartão';
  if (upper === 'TRANSFER' || upper === 'TRANSFERÊNCIA' || upper === 'TRANSFERENCIA') return 'Transferência';
  if (upper === 'CASH' || upper === 'DINHEIRO') return 'Dinheiro';
  return 'Outro';
}

export const ExpensesView: React.FC = () => {
  const { expenses, jobs, users, addExpense, updateExpense, deleteExpense, userRole, language, currentUser, currentCompany } = useApp();

  // Guard: Restricted access check
  if (userRole === 'CLEANER') {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-amber-200 dark:border-amber-900/50 shadow-sm max-w-2xl mx-auto text-center space-y-4 my-8 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          Acesso Restrito
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
          O módulo de <strong>Despesas Operacionais</strong> é de uso exclusivo da gestão da {currentCompany.name} para controle de caixa e cálculo do saldo líquido da empresa.
        </p>
      </div>
    );
  }

  // State
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'all' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  // Form state
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [formData, setFormData] = useState({
    date: todayStr,
    category: 'Combustível',
    description: '',
    amount: '',
    paymentMethod: 'CARD',
    notes: '',
  });

  // Calculate start and end date string based on period selection
  const periodRange = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (period === 'today') {
      return { start: today, end: today };
    }

    if (period === 'week') {
      const dayOfWeek = now.getDay();
      const diffToMon = (dayOfWeek + 6) % 7;
      const mon = new Date(now);
      mon.setDate(now.getDate() - diffToMon);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return {
        start: mon.toISOString().split('T')[0],
        end: sun.toISOString().split('T')[0],
      };
    }

    if (period === 'month') {
      const y = now.getFullYear();
      const m = now.getMonth();
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }

    if (period === 'last_month') {
      const y = now.getFullYear();
      const m = now.getMonth() - 1;
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      return { start, end };
    }

    if (period === 'custom' && customStart && customEnd) {
      return { start: customStart, end: customEnd };
    }

    return { start: '', end: '' }; // All time
  }, [period, customStart, customEnd]);

  // Filter jobs by date range for financial calculation
  const periodJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (j.status === 'CANCELLED' || j.isDeleted) return false;
      if (periodRange.start && j.date < periodRange.start) return false;
      if (periodRange.end && j.date > periodRange.end) return false;
      return true;
    });
  }, [jobs, periodRange]);

  // Filter expenses by date range, category, and search query
  const periodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (periodRange.start && e.date < periodRange.start) return false;
      if (periodRange.end && e.date > periodRange.end) return false;
      return true;
    });
  }, [expenses, periodRange]);

  const filteredExpenses = useMemo(() => {
    return periodExpenses.filter((e) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const norm = normalizeCategory(e.category);
        if (norm !== selectedCategory) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const catMatch = normalizeCategory(e.category).toLowerCase().includes(q);
        const notesMatch = (e.notes || '').toLowerCase().includes(q);
        const pmMatch = getPaymentMethodLabel(e.paymentMethod).toLowerCase().includes(q);
        if (!descMatch && !catMatch && !notesMatch && !pmMatch) return false;
      }
      return true;
    });
  }, [periodExpenses, selectedCategory, searchQuery]);

  // Calculate company financials for the selected period range
  const financialSummary = useMemo(() => {
    return calculateCompanyFinancials(periodJobs, periodExpenses, users);
  }, [periodJobs, periodExpenses, users]);

  const totalRevenue = financialSummary.totalRevenue;
  const totalStaffWages = financialSummary.totalStaffWages;
  const totalOperatingExpenses = financialSummary.totalOperatingExpenses;
  const companyBalance = financialSummary.netCompanyProfit;

  // Chart 1: Expenses Evolution over period
  const evolutionChartData = useMemo(() => {
    const map = new Map<string, number>();

    // Sort period expenses by date
    const sorted = [...periodExpenses].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach((e) => {
      const d = e.date;
      map.set(d, (map.get(d) || 0) + (e.amount || 0));
    });

    if (map.size === 0) {
      return [{ date: 'Sem Dados', amount: 0 }];
    }

    return Array.from(map.entries()).map(([dateStr, amount]) => {
      // Format YYYY-MM-DD to DD/MM
      const parts = dateStr.split('-');
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
      return {
        date: formatted,
        amount: Number(amount.toFixed(2)),
      };
    });
  }, [periodExpenses]);

  // Chart 2: Expense Distribution by Category
  const categoryDistributionData = useMemo(() => {
    const totals: Record<string, number> = {
      Combustível: 0,
      Salários: 0,
      'Produtos de Limpeza': 0,
      Equipamentos: 0,
      Outros: 0,
    };

    periodExpenses.forEach((e) => {
      const norm = normalizeCategory(e.category);
      totals[norm] = (totals[norm] || 0) + (e.amount || 0);
    });

    return CATEGORIES.map((cat) => ({
      name: cat.label,
      value: Number((totals[cat.id] || 0).toFixed(2)),
      color: cat.hex,
    })).filter((c) => c.value > 0);
  }, [periodExpenses]);

  // Open modal for Create or Edit
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormData({
      date: todayStr,
      category: 'Combustível',
      description: '',
      amount: '',
      paymentMethod: 'CARD',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({
      date: exp.date || todayStr,
      category: normalizeCategory(exp.category),
      description: exp.description || '',
      amount: exp.amount?.toString() || '',
      paymentMethod: exp.paymentMethod || 'CARD',
      notes: exp.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    if (editingExpense) {
      updateExpense(editingExpense.id, {
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: numAmount,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
      });
    } else {
      addExpense({
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: numAmount,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        createdBy: currentUser.name || 'Owner',
      });
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (deletingExpense) {
      deleteExpense(deletingExpense.id);
      setDeletingExpense(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Despesas Operacionais
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Gestão detalhada e auditoria financeira das despesas da {currentCompany.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportFinancialsCSV(currentCompany, jobs, expenses, users)}
            className="px-3.5 py-2.5 text-xs font-semibold bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar CSV
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nova Despesa
          </button>
        </div>
      </div>

      {/* 4 Financial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Despesas Operacionais */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-red-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Despesas Operacionais
            </span>
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-2">
            £{totalOperatingExpenses.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {filteredExpenses.length} {filteredExpenses.length === 1 ? 'despesa cadastrada' : 'despesas cadastradas'}
          </div>
        </div>

        {/* Receita do Período */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-blue-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Receita Bruta (Período)
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <PoundSterling className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">
            £{totalRevenue.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {periodJobs.length} limpezas no período
          </div>
        </div>

        {/* Folha de Pagamento */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-amber-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Folha de Pagamento
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            £{totalStaffWages.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Repasse direto aos Cleaners</div>
        </div>

        {/* Saldo da Empresa (Owner) */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saldo da Empresa (Owner)
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black mt-2 ${companyBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            £{companyBalance.toFixed(2)}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Calculado: Receita - Folha - Despesas
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Period Presets */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'today'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'week'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'month'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setPeriod('last_month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'last_month'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Mês Passado
            </button>
            <button
              onClick={() => setPeriod('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'all'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setPeriod('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'custom'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 lg:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por descrição, obs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Custom date range inputs when 'custom' is selected */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/80 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">De:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Até:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              />
            </div>
          </div>
        )}

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Categoria:
          </span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
            }`}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? `${cat.badgeBg} ${cat.badgeText} ${cat.badgeBorder} shadow-xs`
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Expenses Evolution */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Evolução das Despesas no Período
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Total: £{totalOperatingExpenses.toFixed(2)}</span>
          </div>
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolutionChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any) => [`£${Number(val).toFixed(2)}`, 'Despesa']}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#ef4444" name="Valor (£)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Distribution */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
              Distribuição por Categoria
            </h3>
          </div>

          {categoryDistributionData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryDistributionData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`£${Number(val).toFixed(2)}`, 'Valor']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {categoryDistributionData.map((cat) => {
                  const pct = totalOperatingExpenses > 0 ? ((cat.value / totalOperatingExpenses) * 100).toFixed(0) : '0';
                  return (
                    <div key={cat.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{cat.name}</span>
                      </div>
                      <div className="font-black text-slate-900 dark:text-white">
                        £{cat.value.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-slate-400 text-xs">
              <Receipt className="w-8 h-8 text-slate-300 mb-2" />
              Nenhuma despesa registrada para exibir o gráfico de distribuição neste período.
            </div>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Lista de Despesas Cadastradas
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exibindo {filteredExpenses.length} de {expenses.length} despesas
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> Cadastrar Despesa
          </button>
        </div>

        {filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="p-3">Data</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3">Observações</th>
                  <th className="p-3 text-right">Valor (£)</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredExpenses.map((exp) => {
                  const catInfo = getCategoryInfo(exp.category);
                  const CatIcon = catInfo.icon;
                  const pmLabel = getPaymentMethodLabel(exp.paymentMethod);

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {exp.date}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${catInfo.badgeBg} ${catInfo.badgeText} ${catInfo.badgeBorder}`}
                        >
                          <CatIcon className="w-3.5 h-3.5 shrink-0" />
                          {catInfo.label}
                        </span>
                      </td>

                      <td className="p-3 font-bold text-slate-900 dark:text-white max-w-xs truncate">
                        {exp.description || catInfo.label}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[11px] font-semibold border border-slate-200/80 dark:border-slate-700">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {pmLabel}
                        </span>
                      </td>

                      <td className="p-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {exp.notes || '-'}
                      </td>

                      <td className="p-3 text-right font-black text-red-600 dark:text-red-400 text-sm whitespace-nowrap">
                        -£{exp.amount.toFixed(2)}
                      </td>

                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(exp)}
                            title="Editar Despesa"
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            title="Excluir Despesa"
                            className="p-1.5 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Nenhuma despesa cadastrada.
            </div>
            {(searchQuery || selectedCategory !== 'ALL') && (
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nenhuma despesa corresponde aos filtros aplicados.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingExpense ? 'Editar Despesa' : 'Nova Despesa Operacional'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Data & Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Data *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Categoria *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Descrição *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Abastecimento Van Van1, Detergente industrial..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              {/* Valor (£) & Forma de Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Valor (£) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-red-600 dark:text-red-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Forma de Pagamento
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações
                </label>
                <textarea
                  rows={2}
                  placeholder="Notas adicionais, recibo fiscal..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm cursor-pointer"
                >
                  {editingExpense ? 'Salvar Alterações' : 'Cadastrar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete */}
      {deletingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-700 p-6 space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Excluir Despesa?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Você está prestes a excluir a despesa <strong>"{deletingExpense.description || deletingExpense.category}"</strong> no valor de <strong>£{deletingExpense.amount.toFixed(2)}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingExpense(null)}
                className="flex-1 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm cursor-pointer"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
