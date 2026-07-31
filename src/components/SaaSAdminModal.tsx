import React, { useState } from 'react';
import { X, Building2, Plus, Check, Sparkles, CreditCard } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getTranslation } from '../utils/i18n';
import logoImg from '../assets/logo.png';

interface SaaSAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SaaSAdminModal: React.FC<SaaSAdminModalProps> = ({ isOpen, onClose }) => {
  const {
    companies,
    currentCompany,
    setCurrentCompanyId,
    addCompany,
    updateCompany,
    language,
    userRole,
  } = useApp();

  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompCity, setNewCompCity] = useState('London');
  const [newCompPostcode, setNewCompPostcode] = useState('EC1A 1BB');
  const [newCompPhone, setNewCompPhone] = useState('+44 20 7946 0000');
  const [newCompEmail, setNewCompEmail] = useState('');

  const [basePostcode, setBasePostcode] = useState(
    currentCompany.operationalBasePostcode || 'KT9 1BH'
  );
  const [baseAddress, setBaseAddress] = useState(
    currentCompany.operationalBaseAddress || 'Hook Road, Chessington'
  );
  const [isSavedBase, setIsSavedBase] = useState(false);

  if (!isOpen) return null;

  const handleSaveBaseSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!basePostcode.trim()) return;
    updateCompany(currentCompany.id, {
      operationalBasePostcode: basePostcode.toUpperCase().trim(),
      operationalBaseAddress: baseAddress.trim(),
    });
    setIsSavedBase(true);
    setTimeout(() => setIsSavedBase(false), 2500);
  };

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompName) return;

    addCompany({
      name: newCompName,
      code: newCompName.slice(0, 3).toUpperCase(),
      address: 'Central Office',
      postcode: newCompPostcode,
      city: newCompCity,
      phone: newCompPhone,
      email: newCompEmail || `admin@${newCompName.toLowerCase().replace(/\s+/g, '')}.co.uk`,
      ownerName: 'Owner User',
      currency: '£',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
    });

    setNewCompName('');
    setIsAddingCompany(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
              {getTranslation(language, 'saasTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* SaaS Overview Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden">
            <Sparkles className="w-24 h-24 absolute -right-4 -bottom-4 opacity-15 pointer-events-none" />
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <img
                  src={currentCompany.logoUrl && (currentCompany.logoUrl.startsWith('http://') || currentCompany.logoUrl.startsWith('https://') || currentCompany.logoUrl.startsWith('data:') || currentCompany.logoUrl.startsWith('/')) ? currentCompany.logoUrl : logoImg}
                  alt={currentCompany.name}
                  className="w-12 h-12 aspect-square object-contain shrink-0 bg-white/10 p-1 rounded-xl"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.onerror = null;
                    target.src = logoImg || '/logo.png';
                  }}
                />
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30 mb-1">
                    {getTranslation(language, 'multiTenantEngine')}
                  </span>
                  <h4 className="text-xl font-bold">{currentCompany.name}</h4>
                  <p className="text-xs text-blue-200">
                    {getTranslation(language, 'planLabel')} <span className="font-bold text-white">{currentCompany.subscriptionPlan}</span> • {getTranslation(language, 'statusLabel')}{' '}
                    <span className="font-bold text-emerald-400">{currentCompany.subscriptionStatus}</span>
                  </p>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur px-3 py-1.5 rounded-xl text-right">
                <div className="text-xs text-blue-200">{getTranslation(language, 'activeBranchCode')}</div>
                <div className="text-sm font-mono font-bold">{currentCompany.code}</div>
              </div>
            </div>
          </div>

          {/* Operational Base Config Section */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" /> Base Operacional da Empresa (Depot)
                </h4>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                  Toda rota diária da equipe começará obrigatoriamente neste ponto inicial.
                </p>
              </div>
              <span className="font-mono text-xs font-black bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 px-2.5 py-1 rounded-lg">
                {currentCompany.operationalBasePostcode || 'KT9 1BH'}
              </span>
            </div>

            <form onSubmit={handleSaveBaseSettings} className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                  Postcode Inicial (UK)
                </label>
                <input
                  type="text"
                  value={basePostcode}
                  onChange={(e) => setBasePostcode(e.target.value.toUpperCase())}
                  placeholder="KT9 1BH"
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200 block mb-1">
                  Endereço do Depot / Home Base
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={baseAddress}
                    onChange={(e) => setBaseAddress(e.target.value)}
                    placeholder="Hook Road, Chessington"
                    className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 shadow-sm transition-all"
                  >
                    {isSavedBase ? <Check className="w-4 h-4 text-white" /> : null}
                    {isSavedBase ? 'Salvo!' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Company Switcher List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {getTranslation(language, 'managedBranches')} ({companies.length})
              </h4>
              {userRole === 'OWNER' && (
                <button
                  onClick={() => setIsAddingCompany(!isAddingCompany)}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {getTranslation(language, 'newBusiness')}
                </button>
              )}
            </div>

            {/* Form to add company */}
            {isAddingCompany && (
              <form onSubmit={handleCreateCompany} className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 mb-4">
                <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {getTranslation(language, 'setupNewBranch')}
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{getTranslation(language, 'companyNameInput')}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. W & J Cleaners Bristol"
                      value={newCompName}
                      onChange={(e) => setNewCompName(e.target.value)}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{getTranslation(language, 'cityInput')}</label>
                    <input
                      type="text"
                      value={newCompCity}
                      onChange={(e) => setNewCompCity(e.target.value)}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{getTranslation(language, 'postcodeInput')}</label>
                    <input
                      type="text"
                      value={newCompPostcode}
                      onChange={(e) => setNewCompPostcode(e.target.value)}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">{getTranslation(language, 'phoneInput')}</label>
                    <input
                      type="text"
                      value={newCompPhone}
                      onChange={(e) => setNewCompPhone(e.target.value)}
                      className="w-full mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingCompany(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                  >
                    {getTranslation(language, 'cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                  >
                    {getTranslation(language, 'createCompany')}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {companies.map((comp) => {
                const isActive = comp.id === currentCompany.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => {
                      setCurrentCompanyId(comp.id);
                    }}
                    className={`p-3.5 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${
                      isActive
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {comp.name}
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase bg-blue-600 text-white px-2 py-0.5 rounded-full">
                            {getTranslation(language, 'activeBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {comp.city}, {comp.postcode} • Tel: {comp.phone}
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <span className="text-xs font-medium text-slate-500 hover:text-slate-800">
                        {getTranslation(language, 'switchBtn')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Tiers Demo */}
          <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'saasPlansTitle')}
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-center">
                <div className="text-xs font-bold text-slate-500">{getTranslation(language, 'starterPlan')}</div>
                <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">£29<span className="text-xs font-normal">{getTranslation(language, 'perMonth')}</span></div>
                <div className="text-[10px] text-slate-500 mt-1">{getTranslation(language, 'upTo3Cleaners')}</div>
              </div>
              <div className="p-3 border-2 border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 text-center relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  {getTranslation(language, 'mostPopular')}
                </span>
                <div className="text-xs font-bold text-blue-700 dark:text-blue-300">{getTranslation(language, 'proPlan')}</div>
                <div className="text-lg font-black text-blue-900 dark:text-blue-100 mt-1">£59<span className="text-xs font-normal">{getTranslation(language, 'perMonth')}</span></div>
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{getTranslation(language, 'unlimitedCleanersRoute')}</div>
              </div>
              <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-center">
                <div className="text-xs font-bold text-slate-500">{getTranslation(language, 'enterprisePlan')}</div>
                <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">£119<span className="text-xs font-normal">{getTranslation(language, 'perMonth')}</span></div>
                <div className="text-[10px] text-slate-500 mt-1">{getTranslation(language, 'multiBranchCustomApp')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
