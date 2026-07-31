import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CleaningJob, User } from '../../types';
import { Clock, MapPin, AlertTriangle, UserCheck, Navigation, Crosshair } from 'lucide-react';
import { getPostcodeCoords, optimizeRoute } from '../../utils/routeOptimizer';
import { useApp } from '../../context/AppContext';

interface LiveRouteMapProps {
  todayJobs: CleaningJob[];
  users: User[];
  selectedJob: CleaningJob | null;
  onSelectJob: (job: CleaningJob) => void;
  selectedCleanerId?: string | 'ALL';
  onSelectCleaner?: (cleanerId: string) => void;
}

// Color palette for different cleaners on the map
const CLEANER_COLORS = [
  { main: '#2563eb', bg: 'bg-blue-600', gradient: 'from-blue-600 to-indigo-600', ring: 'ring-blue-500/40' },
  { main: '#059669', bg: 'bg-emerald-600', gradient: 'from-emerald-600 to-teal-600', ring: 'ring-emerald-500/40' },
  { main: '#9333ea', bg: 'bg-purple-600', gradient: 'from-purple-600 to-pink-600', ring: 'ring-purple-500/40' },
  { main: '#d97706', bg: 'bg-amber-600', gradient: 'from-amber-600 to-orange-600', ring: 'ring-amber-500/40' },
  { main: '#e11d48', bg: 'bg-rose-600', gradient: 'from-rose-600 to-red-600', ring: 'ring-rose-500/40' },
];

export const LiveRouteMapComponent: React.FC<LiveRouteMapProps> = ({
  todayJobs,
  users,
  selectedJob,
  onSelectJob,
  selectedCleanerId = 'ALL',
  onSelectCleaner,
}) => {
  const { currentUser, userLocation, locationPermissionState, requestLocationPermission } = useApp();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<L.Polyline[]>([]);

  const isCleanerRole = currentUser.role === 'CLEANER';

  // Filter jobs by cleaner role
  const filteredJobs = useMemo(() => {
    if (isCleanerRole) {
      return todayJobs.filter((job) => job.cleanerId === currentUser.id);
    }
    return todayJobs;
  }, [todayJobs, isCleanerRole, currentUser.id]);

  // Group jobs by cleaner
  const cleanerGroups = useMemo(() => {
    const groups: Map<string, { cleaner: User | null; cleanerName: string; jobs: CleaningJob[] }> = new Map();

    filteredJobs.forEach((job) => {
      const cleanerId = job.cleanerId || 'unassigned';
      const foundUser = users.find((u) => u.id === cleanerId) || null;
      const cleanerName = job.cleanerName || foundUser?.name || 'Não Atribuído';

      if (!groups.has(cleanerId)) {
        groups.set(cleanerId, {
          cleaner: foundUser,
          cleanerName,
          jobs: [],
        });
      }
      groups.get(cleanerId)!.jobs.push(job);
    });

    return groups;
  }, [filteredJobs, users]);

  // List of cleaners without home address or GPS
  const missingAddressCleaners = useMemo(() => {
    if (isCleanerRole) return [];
    const list: User[] = [];
    cleanerGroups.forEach(({ cleaner }) => {
      if (cleaner && cleaner.id !== currentUser.id && (!cleaner.homePostcode || !cleaner.homePostcode.trim()) && (!cleaner.homeAddress || !cleaner.homeAddress.trim())) {
        list.push(cleaner);
      }
    });
    return list;
  }, [cleanerGroups, isCleanerRole, currentUser.id]);

  // Initialize Leaflet map instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([51.5074, -0.1278], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render markers and polylines per cleaner
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers and polylines
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];

    if (filteredJobs.length === 0 && !userLocation) return;

    const allBoundingCoords: [number, number][] = [];
    let colorIdx = 0;

    cleanerGroups.forEach(({ cleaner, cleanerName, jobs }, cleanerId) => {
      // Filter if a specific cleaner is selected (for admin)
      if (!isCleanerRole && selectedCleanerId !== 'ALL' && selectedCleanerId !== cleanerId) return;

      const palette = CLEANER_COLORS[colorIdx % CLEANER_COLORS.length];
      colorIdx++;

      const isCurrentLoggedInUser = (cleaner?.id || cleanerId) === currentUser.id;
      const isGpsActive = isCurrentLoggedInUser && Boolean(userLocation);

      const routePoints: [number, number][] = [];

      let startLatLng: [number, number] | null = null;
      let startLabel = '';

      if (isGpsActive && userLocation) {
        startLatLng = [userLocation.lat, userLocation.lng];
        startLabel = 'Minha Localização';
      } else {
        const homePostcode = cleaner?.homePostcode || '';
        const homeAddress = cleaner?.homeAddress || '';
        if (homePostcode.trim() || homeAddress.trim()) {
          const startCoords = getPostcodeCoords(homePostcode.trim() || homeAddress.trim());
          startLatLng = [startCoords.lat, startCoords.lng];
          const firstName = cleanerName.split(' ')[0] || cleanerName;
          startLabel = `Início - Casa de ${firstName}`;
        }
      }

      if (startLatLng) {
        routePoints.push(startLatLng);
        allBoundingCoords.push(startLatLng);

        // Render Start Marker (GPS or Home)
        const startHtml = isGpsActive
          ? `
            <div class="relative group">
              <div class="px-3 py-1 rounded-xl text-white font-black text-xs border-2 border-white shadow-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 ring-4 ring-emerald-500/30">
                <span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                <span>📍 Minha Localização</span>
              </div>
            </div>
          `
          : `
            <div class="relative group">
              <div class="px-2.5 py-1 rounded-xl text-white font-black text-xs border-2 border-white shadow-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer bg-gradient-to-r ${palette.gradient}">
                <span>🏠</span>
                <span>${startLabel}</span>
              </div>
            </div>
          `;

        const startIcon = L.divIcon({
          html: startHtml,
          className: 'custom-start-marker',
          iconSize: [150, 32],
          iconAnchor: [75, 16],
        });

        const startMarker = L.marker(startLatLng, { icon: startIcon }).addTo(map);
        startMarker.bindTooltip(
          `
          <div class="p-1 font-sans text-xs">
            <div class="font-bold ${isGpsActive ? 'text-emerald-600' : 'text-blue-600'}">
              ${isGpsActive ? '📍 GPS em Tempo Real' : '🏠 Início da Rota (Residência)'}
            </div>
            <div class="font-extrabold text-slate-900">${isGpsActive ? 'Sua Posição Atual' : `Casa de ${cleanerName}`}</div>
          </div>
          `,
          { direction: 'top', offset: [0, -10] }
        );

        markersRef.current.set(`start-${cleanerId}`, startMarker);
      }

      // Optimize route sequence using custom GPS start coords if current user
      const originPostcode = cleaner?.homePostcode || 'KT9 1BH';
      const originAddress = cleaner?.homeAddress || 'Operational Base';
      const routeResult = optimizeRoute(
        originPostcode,
        originAddress,
        jobs,
        isGpsActive && userLocation ? userLocation : undefined
      );

      routeResult.jobsInOrder.forEach((job, idx) => {
        const jobCoordsObj = getPostcodeCoords(job.postcode);
        const jobLatLng: [number, number] = [jobCoordsObj.lat, jobCoordsObj.lng];

        routePoints.push(jobLatLng);
        allBoundingCoords.push(jobLatLng);

        const isSelected = selectedJob?.id === job.id;
        const isCompleted = job.status === 'COMPLETED';

        const customHtml = `
          <div class="relative group">
            <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-lg transition-transform cursor-pointer ${
              isSelected
                ? 'bg-blue-600 text-white border-white scale-120 ring-4 ring-blue-500/50'
                : isCompleted
                ? 'bg-emerald-600 text-white border-white'
                : `${palette.bg} text-white border-white`
            }">
              #${idx + 1}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: customHtml,
          className: 'custom-map-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker(jobLatLng, { icon: customIcon }).addTo(map);

        marker.bindTooltip(
          `
          <div class="p-1.5 font-sans text-xs">
            <div class="font-bold text-blue-600">#${idx + 1} ${job.startTime} (${cleanerName})</div>
            <div class="font-extrabold text-slate-900">${job.clientName}</div>
            <div class="text-[10px] text-slate-500">${job.address}, ${job.postcode}</div>
          </div>
          `,
          { direction: 'top', offset: [0, -10] }
        );

        marker.on('click', () => {
          onSelectJob(job);
        });

        markersRef.current.set(job.id, marker);
      });

      // Draw route polyline
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color: isGpsActive ? '#059669' : palette.main,
          weight: 4,
          opacity: 0.85,
          dashArray: '8, 8',
        }).addTo(map);

        polylinesRef.current.push(polyline);
      }
    });

    if (allBoundingCoords.length > 0) {
      const bounds = L.latLngBounds(allBoundingCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredJobs, cleanerGroups, selectedCleanerId, selectedJob, userLocation, currentUser.id, isCleanerRole]);

  // Center on selected job if active
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedJob) return;

    const coordsObj = getPostcodeCoords(selectedJob.postcode);
    map.panTo([coordsObj.lat, coordsObj.lng], { animate: true });
  }, [selectedJob]);

  const cleanerList = Array.from(cleanerGroups.values());

  return (
    <div className="relative w-full h-full min-h-[340px]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* GPS Status Indicator & Trigger */}
      <div className="absolute top-3 right-3 z-10">
        {userLocation ? (
          <div className="px-3 py-1.5 bg-emerald-600/90 text-white rounded-xl text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-emerald-400">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <Navigation className="w-3.5 h-3.5" />
            <span>GPS Ao Vivo Ativo</span>
          </div>
        ) : (
          <button
            onClick={requestLocationPermission}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-blue-400 transition-all active:scale-95"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{locationPermissionState === 'denied' ? 'Ativar GPS (Negado)' : 'Usar Minha Localização'}</span>
          </button>
        )}
      </div>

      {/* Floating Cleaner Route Tabs / Selector Overlay (ADMIN ONLY) */}
      {!isCleanerRole && cleanerList.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-[70%] sm:max-w-[80%]">
          <button
            onClick={() => onSelectCleaner && onSelectCleaner('ALL')}
            className={`px-3 py-1 rounded-xl text-[11px] font-extrabold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 border ${
              selectedCleanerId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Todas as Rotas ({filteredJobs.length})
          </button>

          {cleanerList.map(({ cleaner, cleanerName, jobs }) => {
            const cleanerId = cleaner?.id || cleanerName;
            const isSelected = selectedCleanerId === cleanerId;
            const firstName = cleanerName.split(' ')[0] || cleanerName;
            const hasHome = Boolean(cleaner?.homePostcode || cleaner?.homeAddress);

            return (
              <button
                key={cleanerId}
                onClick={() => onSelectCleaner && onSelectCleaner(cleanerId)}
                className={`px-3 py-1 rounded-xl text-[11px] font-extrabold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white'
                }`}
              >
                <span>{hasHome ? '🏠' : '⚠️'}</span>
                <span>{firstName} ({jobs.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Warning Banner for Admin if cleaner lacks address */}
      {!isCleanerRole && missingAddressCleaners.length > 0 && (
        <div className="absolute top-14 left-3 right-3 sm:right-auto sm:max-w-md z-20 bg-amber-500/95 text-slate-900 dark:text-slate-900 backdrop-blur-md p-2.5 rounded-2xl shadow-xl border border-amber-400 text-xs font-bold flex items-start gap-2 animate-in slide-in-from-top-2 duration-200">
          <AlertTriangle className="w-4 h-4 text-slate-900 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold uppercase text-[10px] text-slate-900 block tracking-wider">Aviso para o Administrador</span>
            <span>
              O(s) funcionário(s) <strong>{missingAddressCleaners.map((u) => u.name).join(', ')}</strong> não possui(em) endereço residencial cadastrado. Cadastre no perfil para iniciar a rota na residência.
            </span>
          </div>
        </div>
      )}

      {/* Selected Location Overlay Card */}
      {selectedJob && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:max-w-xs z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                LOCAL SELECIONADO
              </span>
              <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                {selectedJob.clientName}
              </h4>
            </div>
            <span className="font-black text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
              £{selectedJob.price}
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="truncate">{selectedJob.address}, {selectedJob.postcode}</span>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>{selectedJob.startTime} ({selectedJob.estimatedDuration} hrs)</span>
            </div>
            {selectedJob.cleanerName && (
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{selectedJob.cleanerName.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const LiveRouteMap = React.memo(LiveRouteMapComponent);
