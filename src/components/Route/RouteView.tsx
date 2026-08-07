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
      return allTodayJobs.filter((j) => j.cleanerId?.includes(currentUser.id));
    }
    return allTodayJobs;
  }, [jobs, clients, todayStr, currentCompany.id, isCleanerRole, currentUser.id]);

  // Group active jobs by cleaner / team
  const cleanerRouteData = useMemo(() => {
    const map = new Map<string, { cleaner: User | null; cleanerName: string; jobs: CleaningJob[] }>();

    todayJobs.forEach((job) => {
      const primaryCleanerId = job.cleanerId ? job.cleanerId.split(/[,;]+/)[0].trim() : 'unassigned';
      const foundUser = users.find((u) => u.id === primaryCleanerId) || null;
      const cleanerName = foundUser?.name || job.cleanerName?.split(/[,;]+/)[0]?.trim() || getTranslation(language, 'unassignedCleaner');

      if (!map.has(primaryCleanerId)) {
        map.set(primaryCleanerId, {
          cleaner: foundUser,
          cleanerName,
          jobs: [],
        });
      }
      map.get(primaryCleanerId)!.jobs.push(job);
    });

    return Array.from(map.values());
  }, [todayJobs, users, language]);

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

  const mainGoogleMapsUrl = useMemo(() => {
    if (activeRoutesToDisplay.length > 0) {
      return activeRoutesToDisplay[0].routeResult.googleMapsUrl;
    }
    return perCleanerCalculatedRoutes[0]?.routeResult?.googleMapsUrl || '';
  }, [activeRoutesToDisplay, perCleanerCalculatedRoutes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-700/50">
        <Sparkles className="w-48 h-48 absolute -right-10 -bottom-10 opacity-10 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-xs font-bold text-emerald-200 mb-2">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              {userLocation ? getTranslation(language, 'gpsRealTimeActive') : getTranslation(language, 'routeOptimizationByAddress')}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {getTranslation(language, 'routeTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-xl">
              {isCleanerRole
                ? getTranslation(language, 'cleanerRouteSubtitle')
                : getTranslation(language, 'adminRouteSubtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!userLocation && (
              <button
                onClick={requestLocationPermission}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Crosshair className="w-4 h-4" />
                <span>{locationPermissionState === 'denied' ? getTranslation(language, 'activateGpsDenied') : getTranslation(language, 'useGpsPosition')}</span>
              </button>
            )}

            {mainGoogleMapsUrl && (
              <a
                href={mainGoogleMapsUrl}
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
              <Users className="w-4 h-4 text-emerald-600" /> {getTranslation(language, 'selectStaffRouteToday')} ({perCleanerCalculatedRoutes.length})
            </label>
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                {getTranslation(language, 'startPointGpsOrHome')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStaffId('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                selectedStaffId === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>{getTranslation(language, 'allStaffMembers')} ({totalClientsCount} {getTranslation(language, 'clients').toLowerCase()})</span>
            </button>

            {perCleanerCalculatedRoutes.map(({ cleaner, cleanerName, staffJobs, hasHomeAddress, isGpsActive }) => {
              const cleanerId = cleaner?.id || cleanerName;
              const isSel = selectedStaffId === cleanerId;

              return (
                <button
                  key={cleanerId}
                  onClick={() => setSelectedStaffId(cleanerId)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSel
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span>{isGpsActive ? '📍' : hasHomeAddress ? '🏠' : '⚠️'}</span>
                  <span>{cleanerName} ({staffJobs.length} {getTranslation(language, 'clients').toLowerCase()})</span>
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
            {userLocation ? getTranslation(language, 'fromRealtimeGps') : getTranslation(language, 'fromStaffHomes')}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'totalTravelTime')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ~{totalTravelMinsAll} {getTranslation(language, 'minutes')}
          </div>
          <div className="text-[10px] text-blue-600 font-semibold mt-0.5">{getTranslation(language, 'urbanTravelEstimate')}</div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
          <span className="text-xs text-slate-500 font-bold uppercase">{getTranslation(language, 'scheduledServices')}</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalClientsCount} {getTranslation(language, 'servicesUnit')}
          </div>
          <div className="text-[10px] text-purple-600 font-semibold mt-0.5">{getTranslation(language, 'dateLabel')} {todayStr}</div>
        </div>
      </div>

      {/* Cleaner Independent Route Cards */}
      {activeRoutesToDisplay.length === 0 ? (
        <div className="p-8 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isCleanerRole
              ? getTranslation(language, 'noJobsCleanerToday')
              : getTranslation(language, 'noJobsAdminToday')}
          </p>
          <p className="text-xs text-slate-500">{getTranslation(language, 'scheduleJobsHint')}</p>
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
                        {getTranslation(language, 'routeOf')} {cleanerName}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                        {staffJobs.length} {staffJobs.length === 1 ? getTranslation(language, 'serviceUnit') : getTranslation(language, 'servicesUnit')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      {isGpsActive ? (
                        <>
                          <Crosshair className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                          <span>{getTranslation(language, 'startingPoint')} <strong className="text-emerald-600 font-bold">{getTranslation(language, 'myLocationGps')}</strong></span>
                        </>
                      ) : (
                        <>
                          <Home className="w-3.5 h-3.5 text-blue-600" />
                          <span>{getTranslation(language, 'startingPoint')} <strong>{hasHomeAddress ? `${originAddress}, ${originPostcode}` : getTranslation(language, 'originNotRegistered')}</strong></span>
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
                        {getTranslation(language, 'routeOriginWarning')}
                      </h4>
                      <p className="mt-0.5">
                        {isCleanerRole
                          ? getTranslation(language, 'cleanerGpsWarning')
                          : (language === 'pt'
                              ? `O funcionário ${cleanerName} não possui GPS ativo ou endereço residencial cadastrado. Cadastre no perfil do funcionário.`
                              : `The staff member ${cleanerName} does not have an active GPS or home address registered. Please update in staff profile.`)}
                      </p>
                    </div>
                  </div>
                  {!isCleanerRole && (
                    <button
                      onClick={() => setActiveTab('team')}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl whitespace-nowrap self-end sm:self-center shrink-0 shadow-xs transition-all cursor-pointer"
                    >
                      {getTranslation(language, 'editProfile')}
                    </button>
                  )}
                </div>
              )}

              {/* Schedule Delay Warning Banner for Cleaner/Admin */}
              {routeResult.hasScheduleDelayAlert && (
                <div className="bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 p-4 rounded-2xl flex items-center gap-3 text-rose-900 dark:text-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div className="text-xs">
                    <h4 className="font-extrabold uppercase tracking-wider text-[11px] text-rose-800 dark:text-rose-300">
                      {getTranslation(language, 'scheduleDelayWarningTitle')}
                    </h4>
                    <p className="mt-0.5">
                      {language === 'pt'
                        ? `Atenção: A previsão de deslocamento e duração indica risco de atraso em cliente(s) (acumulado de ${routeResult.totalDelayMinutes} min). Verifique os destaques em amarelo/vermelho abaixo.`
                        : `Warning: Route travel and service durations indicate delay risk (${routeResult.totalDelayMinutes} min total). Check highlighted stops below.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Route Sequence List */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {getTranslation(language, 'optimizedSequence')} ({routeResult.totalDistanceMiles} {getTranslation(language, 'miles')} • ~{routeResult.totalTravelTimeMinutes} {getTranslation(language, 'travelMin')})
                </h4>

                {/* START ITEM: Cleaner Residence or GPS */}
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {isGpsActive ? '📍' : '🏠'}
                  </div>
                  <div>
                    <div className="font-extrabold text-xs text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                      <span>{getTranslation(language, 'routeStart')} - {isGpsActive ? getTranslation(language, 'myLocationGps') : `${language === 'pt' ? 'Casa de' : 'Home of'} ${cleanerName}`}</span>
                      {isGpsActive ? (
                        <span className="bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">
                          {getTranslation(language, 'liveGpsBadge')}
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
                {routeResult.jobsInOrder.map((job, idx) => {
                  const val = routeResult.scheduleValidations?.[job.id];
                  const isWarning = val?.delayStatus === 'warning';
                  const isCritical = val?.delayStatus === 'critical';

                  let cardStyle = 'p-4 rounded-2xl border flex flex-col gap-3 shadow-xs transition-all ';
                  if (isCritical) {
                    cardStyle += 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-100';
                  } else if (isWarning) {
                    cardStyle += 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100';
                  } else {
                    cardStyle += 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-700/80 hover:border-blue-400';
                  }

                  return (
                    <div key={job.id} className={cardStyle}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                            isCritical
                              ? 'bg-rose-600 text-white'
                              : isWarning
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span>{job.clientName}</span>
                              <span className="text-xs font-semibold text-emerald-600">
                                £{job.price}
                              </span>
                              {val && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                  isCritical
                                    ? 'bg-rose-200 text-rose-900 border-rose-300 dark:bg-rose-900 dark:text-rose-100'
                                    : isWarning
                                    ? 'bg-amber-200 text-amber-900 border-amber-300 dark:bg-amber-900 dark:text-amber-100'
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}>
                                  {isCritical
                                    ? `⚠️ ${getTranslation(language, 'criticalDelayWarning')} (+${val.delayMinutes}m)`
                                    : isWarning
                                    ? `⚠️ ${getTranslation(language, 'slightDelayWarning')} (+${val.delayMinutes}m)`
                                    : `✓ ${getTranslation(language, 'scheduleOnTime')}`}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span>{job.address}, <strong className="text-slate-800 dark:text-slate-200">{job.postcode}</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 self-end sm:self-center">
                          <div className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>Agendado: {job.startTime} ({job.estimatedDuration}h)</span>
                          </div>
                          {val && (
                            <div className={`flex items-center gap-1 font-bold px-2.5 py-1 rounded-lg border ${
                              isCritical
                                ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200'
                                : isWarning
                                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200'
                            }`}>
                              <span>Chegada est.: <strong>{val.estimatedArrivalTime}</strong></span>
                              <span className="opacity-60">•</span>
                              <span>Saída est.: <strong>{val.estimatedDepartureTime}</strong></span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-emerald-600 font-bold">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{cleanerName.split(' ')[0]}</span>
                          </div>
                        </div>
                      </div>

                      {/* Schedule Delay Warning Box */}
                      {val && (isWarning || isCritical) && (
                        <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                          isCritical
                            ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/60 dark:text-rose-100'
                            : 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/60 dark:text-amber-100'
                        }`}>
                          <AlertTriangle className={`w-4 h-4 shrink-0 ${isCritical ? 'text-rose-600 animate-bounce' : 'text-amber-600'}`} />
                          <span>{language === 'pt' ? val.alertMessagePt : val.alertMessageEn}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export const RouteView = React.memo(RouteViewComponent);
