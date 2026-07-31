import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CleaningJob, User } from '../../types';
import { Clock, MapPin, AlertTriangle, UserCheck } from 'lucide-react';
import { getPostcodeCoords } from '../../utils/routeOptimizer';

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
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<L.Polyline[]>([]);

  // Group jobs by cleaner
  const cleanerGroups = useMemo(() => {
    const groups: Map<string, { cleaner: User | null; cleanerName: string; jobs: CleaningJob[] }> = new Map();

    todayJobs.forEach((job) => {
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
  }, [todayJobs, users]);

  // List of cleaners without home address
  const missingAddressCleaners = useMemo(() => {
    const list: User[] = [];
    cleanerGroups.forEach(({ cleaner }) => {
      if (cleaner && (!cleaner.homePostcode || !cleaner.homePostcode.trim()) && (!cleaner.homeAddress || !cleaner.homeAddress.trim())) {
        list.push(cleaner);
      }
    });
    return list;
  }, [cleanerGroups]);

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

    if (todayJobs.length === 0) return;

    const allBoundingCoords: [number, number][] = [];
    let colorIdx = 0;

    cleanerGroups.forEach(({ cleaner, cleanerName, jobs }, cleanerId) => {
      // Filter if a specific cleaner is selected
      if (selectedCleanerId !== 'ALL' && selectedCleanerId !== cleanerId) return;

      const palette = CLEANER_COLORS[colorIdx % CLEANER_COLORS.length];
      colorIdx++;

      const routePoints: [number, number][] = [];

      // Check if cleaner has registered home address/postcode
      const homePostcode = cleaner?.homePostcode || '';
      const homeAddress = cleaner?.homeAddress || '';

      if (homePostcode.trim() || homeAddress.trim()) {
        const startPostcode = homePostcode.trim() || homeAddress.trim();
        const startCoords = getPostcodeCoords(startPostcode);
        const homeLatLng: [number, number] = [startCoords.lat, startCoords.lng];

        routePoints.push(homeLatLng);
        allBoundingCoords.push(homeLatLng);

        const firstName = cleanerName.split(' ')[0] || cleanerName;

        // Render Home Starting Marker
        const homeHtml = `
          <div class="relative group">
            <div class="px-2.5 py-1 rounded-xl text-white font-black text-xs border-2 border-white shadow-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer bg-gradient-to-r ${palette.gradient} animate-pulse">
              <span>🏠</span>
              <span>Início - Casa de ${firstName}</span>
            </div>
          </div>
        `;

        const homeIcon = L.divIcon({
          html: homeHtml,
          className: 'custom-home-marker',
          iconSize: [140, 32],
          iconAnchor: [70, 16],
        });

        const homeMarker = L.marker(homeLatLng, { icon: homeIcon }).addTo(map);
        homeMarker.bindTooltip(
          `
          <div class="p-1 font-sans text-xs">
            <div class="font-bold text-emerald-600">🏠 Início da Rota (Residência)</div>
            <div class="font-extrabold text-slate-900">Casa de ${cleanerName}</div>
            <div class="text-[10px] text-slate-500">${homeAddress || homePostcode}</div>
          </div>
          `,
          { direction: 'top', offset: [0, -10] }
        );

        markersRef.current.set(`home-${cleanerId}`, homeMarker);
      }

      // Sort jobs by start time
      const sortedJobs = [...jobs].sort((a, b) => a.startTime.localeCompare(b.startTime));

      sortedJobs.forEach((job, idx) => {
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

      // Draw route polyline from cleaner's home to assigned jobs
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color: palette.main,
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
  }, [todayJobs, cleanerGroups, selectedCleanerId, selectedJob]);

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

      {/* Floating Cleaner Route Tabs / Selector Overlay */}
      {cleanerList.length > 0 && (
        <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5 max-w-[85%]">
          <button
            onClick={() => onSelectCleaner && onSelectCleaner('ALL')}
            className={`px-3 py-1 rounded-xl text-[11px] font-extrabold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 border ${
              selectedCleanerId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Todas as Rotas ({todayJobs.length})
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
      {missingAddressCleaners.length > 0 && (
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
