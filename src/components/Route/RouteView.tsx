import React, { useState, useMemo, useEffect } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  ExternalLink,
  Building2,
  Sparkles,
  Zap,
  Save,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { optimizeRoute } from '../../utils/routeOptimizer';
import { getCombinedJobsForDate } from '../../utils/scheduleGenerator';

const RouteViewComponent: React.FC = () => {
  const { jobs, clients, currentCompany, updateCompany, language, userRole } = useApp();

  const [startingPostcode, setStartingPostcode] = useState(
    currentCompany.operationalBasePostcode || 'KT9 1BH'
  );
  const [startingAddress, setStartingAddress] = useState(
    currentCompany.operationalBaseAddress || 'Hook Road, Chessington'
  );

  useEffect(() => {
    if (currentCompany.operationalBasePostcode) {
      setStartingPostcode(currentCompany.operationalBasePostcode);
    }
    if (currentCompany.operationalBaseAddress) {
      setStartingAddress(currentCompany.operationalBaseAddress);
    }
  }, [currentCompany.operationalBasePostcode, currentCompany.operationalBaseAddress]);

  const [isOptimizing, setIsOptimizing] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const todayJobs = useMemo(
    () =>
      getCombinedJobsForDate(jobs, clients, todayStr, currentCompany.id).filter(
        (j) => j.status !== 'CANCELLED'
      ),
    [jobs, clients, todayStr, currentCompany.id]
  );

  // Optimize route starting from base postcode/address
  const routeResult = useMemo(() => {
    return optimizeRoute(startingPostcode, startingAddress, todayJobs);
  }, [startingPostcode, startingAddress, todayJobs]);

  const orderedJobs = routeResult.jobsInOrder;
  const totalMiles = routeResult.totalDistanceMiles;
  const totalDrivingMins = routeResult.totalTravelTimeMinutes;

  const handleSaveBase = () => {
    if (!startingPostcode.trim()) return;
    updateCompany(currentCompany.id, {
      operationalBasePostcode: startingPostcode.toUpperCase().trim(),
      operationalBaseAddress: startingAddress.trim(),
    });
  };

  const handleOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
    }, 300);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-700/50">
        <Sparkles className="w-48 h-48 absolute -right-10 -bottom-10 opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs font-bold text-emerald-200 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> UK Driving Travel Optimizer
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {getTranslation(language, 'routeTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-xl">
              {getTranslation(language, 'routeSubtitle')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {routeResult.googleMapsUrl ? (
              <a
                href={routeResult.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'openInGoogleMaps')}
              </a>
            ) : null}
            {routeResult.wazeUrl ? (
              <a
                href={routeResult.wazeUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white font-bold text-xs rounded-2xl border border-white/20 flex items-center gap-1.5 transition-all"
              >
                <Navigation className="w-4 h-4" /> {getTranslation(language, 'openInWaze')}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Starting Base Selector */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'cleanerStartingPoint')}
          </label>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            Base Fixa: {currentCompany.operationalBasePostcode || 'KT9 1BH'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Postcode da Base</label>
            <input
              type="text"
              value={startingPostcode}
              onChange={(e) => setStartingPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. KT9 1BH"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-medium text-slate-500 mb-1 block">Endereço da Base / Depot</label>
            <input
              type="text"
              value={startingAddress}
              onChange={(e) => setStartingAddress(e.target.value)}
              placeholder="e.g. Hook Road, Chessington"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
          {(userRole === 'OWNER' || userRole === 'ADMINISTRATOR') && (
            <button
              onClick={handleSaveBase}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" /> Salvar Configuração no Banco de Dados
            </button>
          )}
          <button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all"
          >
            <Navigation className={`w-3.5 h-3.5 ${isOptimizing ? 'animate-spin' : ''}`} />
            {isOptimizing ? 'Recalculando...' : 'Recalcular Sequência'}
          </button>
        </div>
      </div>

      {/* Route Metrics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'totalDistance')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalMiles} {getTranslation(language, 'miles')}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Calculado a partir de {startingPostcode}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'totalTravelTime')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ~{totalDrivingMins} {getTranslation(language, 'minutes')}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Tempo de Tráfego Estimado</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-bold uppercase">Clientes Agendados</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {orderedJobs.length} Clientes
          </div>
          <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Data: {todayStr}</div>
        </div>
      </div>

      {/* Sequence Cards */}
      <div className="space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {getTranslation(language, 'optimalSequence')} (Sequência Otimizada)
        </h3>

        {/* Origin Base Item */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
            START
          </div>
          <div>
            <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <span>Home Base / Depot (Base Operacional)</span>
              <span className="font-mono bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded text-[10px]">
                {startingPostcode}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {startingAddress}, {startingPostcode}
            </div>
          </div>
        </div>

        {/* Jobs in order */}
        {orderedJobs.length === 0 ? (
          <div className="p-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-500">Nenhuma limpeza agendada para hoje. Adicione um cliente na agenda para calcular a rota.</p>
          </div>
        ) : (
          orderedJobs.map((job, idx) => (
            <div
              key={job.id}
              className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-emerald-400 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  #{idx + 1}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    {job.clientName}
                    <span className="text-xs font-semibold text-emerald-600">
                      £{job.price}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>{job.address}, <strong className="text-slate-800 dark:text-slate-200">{job.postcode}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 self-end sm:self-center">
                <div className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{job.startTime} ({job.estimatedDuration} hrs clean)</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const RouteView = React.memo(RouteViewComponent);
