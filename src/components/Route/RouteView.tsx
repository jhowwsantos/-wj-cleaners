import React, { useState, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
  AlertTriangle,
  UserCheck,
  Home,
  Users,
  Crosshair,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';
import { optimizeRoute } from '../../utils/routeOptimizer';
import { getCombinedJobsForDate } from '../../utils/scheduleGenerator';
import { User, CleaningJob } from '../../types';

export const RouteViewComponent: React.FC = () => {
  const {
    jobs,
    clients,
    currentCompany,
    users,
    language,
    currentUser,
    userLocation,
    locationPermissionState,
    requestLocationPermission,
    setActiveTab,
  } = useApp();

  const isCleanerRole = currentUser.role === 'CLEANER';
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's active jobs (filtered by cleaner role if applicable)
  const todayJobs = useMemo(() => {
    const allTodayJobs = getCombinedJobsForDate(jobs, clients, todayStr, currentCompany.id).filter(
      (j) => j.status !== 'CANCELLED'
    );
    if (isCleanerRole) {
      return allTodayJobs.filter((j) => j.cleanerId === currentUser.id);
    }
    return allTodayJobs;
  }, [jobs, clients, todayStr, currentCompany.id, isCleanerRole, currentUser.id]);

  // Group active jobs by cleaner
  const cleanerRouteData = useMemo(() => {
    const map = new Map<string, { cleaner: User | null; cleanerName: string; jobs: CleaningJob[] }>();

    todayJobs.forEach((job) => {
      const cleanerId = job.cleanerId || 'unassigned';
      const foundUser = users.find((u) => u.id === cleanerId) || null;
      const cleanerName = job.cleanerName || foundUser?.name || 'Não Atribuído';

      if (!map.has(cleanerId)) {
        map.set(cleanerId, {
          cleaner: foundUser,
          cleanerName,
          jobs: [],
        });
      }
      map.get(cleanerId)!.jobs.push(job);
    });

    return Array.from(map.values());
  }, [todayJobs, users]);

  // Selected cleaner filter: 'ALL' or cleanerId
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  // Compute optimized route for each cleaner starting at GPS (if current logged-in user) or home address
  const perCleanerCalculatedRoutes = useMemo(() => {
    return cleanerRouteData.map(({ cleaner, cleanerName, jobs: staffJobs }) => {
      const isCurrentLoggedInUser = (cleaner?.id || cleanerName) === currentUser.id;
      const isGpsActive = isCurrentLoggedInUser && Boolean(userLocation);

      const homePostcode = cleaner?.homePostcode?.trim() || '';
      const homeAddress = cleaner?.homeAddress?.trim() || '';
      const hasHomeAddress = Boolean(homePostcode || homeAddress);

      // Default fallback if no home address is set
      const originPostcode = homePostcode || currentCompany.operationalBasePostcode || 'KT9 1BH';
      const originAddress = homeAddress || currentCompany.operationalBaseAddress || 'Hook Road, Chessington';

      const routeResult = optimizeRoute(
        originPostcode,
        originAddress,
        staffJobs,
        isGpsActive && userLocation ? userLocation : undefined
      );

      return {
        cleaner,
        cleanerName,
        staffJobs,
        hasHomeAddress,
        isGpsActive,
        originPostcode,
        originAddress,
        routeResult,
      };
    });
  }, [cleanerRouteData, currentCompany, currentUser.id, userLocation]);

  // Active view filters
  const activeRoutesToDisplay = useMemo(() => {
    if (isCleanerRole) {
      return perCleanerCalculatedRoutes.filter(
        (r) => (r.cleaner?.id || r.cleanerName) === currentUser.id
      );
    }
    if (selectedStaffId === 'ALL') {
      return perCleanerCalculatedRoutes;
    }
    return perCleanerCalculatedRoutes.filter(
      (r) => (r.cleaner?.id || r.cleanerName) === selectedStaffId
    );
  }, [perCleanerCalculatedRoutes, selectedStaffId, isCleanerRole, currentUser.id]);

  // Total summary metrics
  const totalClientsCount = todayJobs.length;
  const totalMilesAll = perCleanerCalculatedRoutes.reduce(
    (acc, r) => acc + r.routeResult.totalDistanceMiles,
    0
  );
  const totalTravelMinsAll = perCleanerCalculatedRoutes.reduce(
    (acc, r) => acc + r.routeResult.totalTravelTimeMinutes,
    0
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-700/50">
        <Sparkles className="w-48 h-48 absolute -right-10 -bottom-10 opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs font-bold text-emerald-200 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              {userLocation ? 'GPS em Tempo Real Ativo' : 'Otimização de Rotas por Endereço'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {getTranslation(language, 'routeTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-xl">
              {isCleanerRole
                ? 'Sua rota é calculada a partir da sua localização GPS atual até os seus clientes agendados para hoje.'
                : 'As rotas são calculadas utilizando a localização GPS em tempo real do usuário ou o endereço residencial cadastrado.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!userLocation && (
              <button
                onClick={requestLocationPermission}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <Crosshair className="w-4 h-4" />
                <span>{locationPermissionState === 'denied' ? 'Ativar GPS (Permissão Negada)' : 'Usar Posição GPS'}</span>
              </button>
            )}

            {todayJobs.length > 0 && (
              <a
                href={`https://www.google.com/maps/dir/${
                  userLocation ? `${userLocation.lat},${userLocation.lng}` : ''
                }/${todayJobs.map((j) => encodeURIComponent(`${j.address}, ${j.postcode}`)).join('/')}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'openInGoogleMaps')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Staff Route Selector Tabs (ADMIN ONLY) */}
      {!isCleanerRole && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" /> Selecionar Rota por Colaborador Escalado Hoje ({perCleanerCalculatedRoutes.length})
            </label>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Ponto de Início: GPS em Tempo Real ou Residência
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStaffId('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedStaffId === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>Todos os Colaboradores ({totalClientsCount} clientes)</span>
            </button>

            {perCleanerCalculatedRoutes.map(({ cleaner, cleanerName, staffJobs, hasHomeAddress, isGpsActive }) => {
              const cleanerId = cleaner?.id || cleanerName;
              const isSel = selectedStaffId === cleanerId;

              return (
                <button
                  key={cleanerId}
                  onClick={() => setSelectedStaffId(cleanerId)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>{isGpsActive ? '📍' : hasHomeAddress ? '🏠' : '⚠️'}</span>
                  <span>{cleanerName} ({staffJobs.length} clientes)</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'totalDistance')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {Math.round(totalMilesAll * 10) / 10} {getTranslation(language, 'miles')}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {userLocation ? 'A partir do GPS em Tempo Real' : 'Partindo das Residências dos Funcionários'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'totalTravelTime')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ~{totalTravelMinsAll} {getTranslation(language, 'minutes')}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Estimativa de Deslocamento Urbano</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-bold uppercase">Serviços Escalados</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalClientsCount} Atendimentos
          </div>
          <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Data: {todayStr}</div>
        </div>
      </div>

      {/* Cleaner Independent Route Cards */}
      {activeRoutesToDisplay.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isCleanerRole
              ? 'Você não possui atendimentos agendados para hoje.'
              : 'Nenhum serviço agendado para o filtro selecionado hoje.'}
          </p>
          <p className="text-xs text-slate-500">Agende serviços na aba Agenda para gerar as rotas diárias.</p>
        </div>
      ) : (
        activeRoutesToDisplay.map(({ cleaner, cleanerName, staffJobs, hasHomeAddress, isGpsActive, originPostcode, originAddress, routeResult }) => {
          const cleanerId = cleaner?.id || cleanerName;

          return (
            <div
              key={cleanerId}
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-md space-y-5"
            >
              {/* Staff Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
                    {cleanerName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                        Rota de {cleanerName}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                        {staffJobs.length} {staffJobs.length === 1 ? 'Serviço' : 'Serviços'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      {isGpsActive ? (
                        <>
                          <Crosshair className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>Ponto de Partida: <strong className="text-emerald-600 font-bold">Minha Localização (GPS em Tempo Real)</strong></span>
                        </>
                      ) : (
                        <>
                          <Home className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ponto de Partida: <strong>{hasHomeAddress ? `${originAddress}, ${originPostcode}` : 'Ponto de Origem Não Cadastrado'}</strong></span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {routeResult.googleMapsUrl && (
                    <a
                      href={routeResult.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Google Maps
                    </a>
                  )}
                  {routeResult.wazeUrl && (
                    <a
                      href={routeResult.wazeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-500" /> Waze
                    </a>
                  )}
                </div>
              </div>

              {/* Warning Box if cleaner lacks registered home address & GPS not active */}
              {!isGpsActive && !hasHomeAddress && (
                <div className="bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-amber-800 dark:text-amber-300">
                        Aviso de Origem da Rota
                      </h4>
                      <p className="mt-0.5">
                        {isCleanerRole
                          ? 'Ative a permissão de localização GPS ou cadastre seu endereço residencial para otimizar sua rota.'
                          : `O funcionário ${cleanerName} não possui GPS ativo ou endereço residencial cadastrado. Cadastre no perfil do funcionário.`}
                      </p>
                    </div>
                  </div>
                  {!isCleanerRole && (
                    <button
                      onClick={() => setActiveTab('team')}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl whitespace-nowrap self-end sm:self-center shrink-0 shadow-xs transition-all"
                    >
                      Editar Perfil
                    </button>
                  )}
                </div>
              )}

              {/* Route Sequence List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Sequência Otimizada ({routeResult.totalDistanceMiles} milhas • ~{routeResult.totalTravelTimeMinutes} min de viagem)
                </h4>

                {/* START ITEM: Cleaner Residence or GPS */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {isGpsActive ? '📍' : '🏠'}
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <span>Início da Rota - {isGpsActive ? 'Minha Localização (GPS em Tempo Real)' : `Casa de ${cleanerName}`}</span>
                      {isGpsActive ? (
                        <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                          Ao Vivo
                        </span>
                      ) : (
                        <span className="font-mono bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                          {originPostcode}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {isGpsActive && userLocation
                        ? `Lat: ${userLocation.lat.toFixed(4)}, Lng: ${userLocation.lng.toFixed(4)}`
                        : `${originAddress}, ${originPostcode}`}
                    </div>
                  </div>
                </div>

                {/* Jobs in Order */}
                {routeResult.jobsInOrder.map((job, idx) => (
                  <div
                    key={job.id}
                    className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-blue-400 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
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
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span>{job.address}, <strong className="text-slate-800 dark:text-slate-200">{job.postcode}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 self-end sm:self-center">
                      <div className="flex items-center gap-1 font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{job.startTime} ({job.estimatedDuration} hrs clean)</span>
                      </div>
                      <div className="flex items-center gap-1 text-emerald-600 font-bold">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{cleanerName.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export const RouteView = React.memo(RouteViewComponent);
