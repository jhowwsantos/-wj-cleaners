import React, { useEffect, useRef, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CleaningJob, User } from '../../types';
import {
  Clock,
  MapPin,
  AlertTriangle,
  UserCheck,
  Navigation,
  Crosshair,
  Maximize2,
  Minimize2,
  Info,
  ExternalLink,
  Route,
  X,
} from 'lucide-react';
import { getPostcodeCoords, getJobCoords, optimizeRoute } from '../../utils/routeOptimizer';
import { getAssignedStaffForJob } from '../../utils/financialCalculations';
import { useApp } from '../../context/AppContext';
import { getTranslation } from '../../utils/i18n';

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
  { main: '#2563eb', bg: 'bg-blue-600', ring: 'ring-blue-500', text: 'text-blue-600', gradient: 'from-blue-600 to-indigo-600' },
  { main: '#059669', bg: 'bg-emerald-600', ring: 'ring-emerald-500', text: 'text-emerald-600', gradient: 'from-emerald-600 to-teal-600' },
  { main: '#9333ea', bg: 'bg-purple-600', ring: 'ring-purple-500', text: 'text-purple-600', gradient: 'from-purple-600 to-pink-600' },
  { main: '#d97706', bg: 'bg-amber-600', ring: 'ring-amber-500', text: 'text-amber-600', gradient: 'from-amber-600 to-orange-600' },
  { main: '#e11d48', bg: 'bg-rose-600', ring: 'ring-rose-500', text: 'text-rose-600', gradient: 'from-rose-600 to-red-600' },
];

// Haversine distance calculator in miles
function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const LiveRouteMapComponent: React.FC<LiveRouteMapProps> = ({
  todayJobs,
  users,
  selectedJob,
  onSelectJob,
  selectedCleanerId = 'ALL',
  onSelectCleaner,
}) => {
  const { currentUser, userLocation, currentCompany, locationPermissionState, requestLocationPermission, language } = useApp();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylinesRef = useRef<L.Polyline[]>([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showSummary, setShowSummary] = useState(true);
  const [closedJobId, setClosedJobId] = useState<string | null>(null);

  // Auto-follow mode state & refs
  const [isFollowMode, setIsFollowMode] = useState(true);
  const isFollowModeRef = useRef(true);
  const isProgrammaticMoveRef = useRef(false);
  const isProgrammaticCleanupRef = useRef(false);
  const hasInitialFitRef = useRef(false);

  const safeProgrammaticMove = (moveFn: () => void) => {
    isProgrammaticMoveRef.current = true;
    moveFn();
    setTimeout(() => {
      isProgrammaticMoveRef.current = false;
    }, 800);
  };

  const isCleanerRole = currentUser.role === 'CLEANER';

  // Filter jobs by cleaner role
  const filteredJobs = useMemo(() => {
    if (isCleanerRole) {
      return todayJobs.filter((job) =>
        getAssignedStaffForJob(job, users).some((u) => u.id === currentUser.id) ||
        job.cleanerId?.includes(currentUser.id)
      );
    }
    return todayJobs;
  }, [todayJobs, isCleanerRole, currentUser.id, users]);

  // Determine current active job to show in overlay card
  const currentJobToShow = useMemo(() => {
    if (!selectedJob) return null;
    if (selectedJob.id === closedJobId) return null;
    return selectedJob;
  }, [selectedJob, closedJobId]);

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
      if (
        cleaner &&
        cleaner.id !== currentUser.id &&
        (!cleaner.homePostcode || !cleaner.homePostcode.trim()) &&
        (!cleaner.homeAddress || !cleaner.homeAddress.trim())
      ) {
        list.push(cleaner);
      }
    });
    return list;
  }, [cleanerGroups, isCleanerRole, currentUser.id]);

  // Route metrics calculation
  const routeMetrics = useMemo(() => {
    let totalMiles = 0;
    let totalDurationHrs = 0;
    const activeCleanersSet = new Set<string>();

    cleanerGroups.forEach(({ cleaner, cleanerName, jobs }, cleanerId) => {
      if (!isCleanerRole && selectedCleanerId !== 'ALL' && selectedCleanerId !== cleanerId) return;

      activeCleanersSet.add(cleanerId);

      const originPostcode = cleaner?.homePostcode || currentCompany.operationalBasePostcode || 'KT9 1BH';
      const originAddress = cleaner?.homeAddress || currentCompany.operationalBaseAddress || 'Hook Road, Chessington';
      const routeResult = optimizeRoute(originPostcode, originAddress, jobs);

      jobs.forEach((j) => {
        totalDurationHrs += j.estimatedDuration || 2;
      });

      let prevCoords: { lat: number; lng: number } | null = null;
      if (cleaner?.homePostcode || cleaner?.homeAddress) {
        prevCoords = getPostcodeCoords(cleaner.homePostcode || cleaner.homeAddress || '');
      }

      routeResult.jobsInOrder.forEach((job) => {
        const coords = getJobCoords(job);
        if (prevCoords) {
          totalMiles += calculateDistanceMiles(prevCoords.lat, prevCoords.lng, coords.lat, coords.lng);
        }
        prevCoords = coords;
      });
    });

    return {
      totalJobs: filteredJobs.length,
      totalMiles: Math.round(totalMiles * 10) / 10,
      estimatedTimeHrs: Math.round((totalDurationHrs + totalMiles * 0.05) * 10) / 10,
      activeCleanersCount: activeCleanersSet.size,
    };
  }, [filteredJobs, cleanerGroups, selectedCleanerId, isCleanerRole]);

  const selectedJobRef = useRef<CleaningJob | null>(selectedJob);
  useEffect(() => {
    selectedJobRef.current = selectedJob;
    if (selectedJob) {
      setClosedJobId(null);
    }
  }, [selectedJob]);

  // Initialize Leaflet map instance
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

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;

    // Register map interaction event listeners to immediately disable auto-follow mode
    const stopFollowMode = (e: L.LeafletEvent) => {
      if (!isProgrammaticMoveRef.current) {
        setIsFollowMode(false);
        isFollowModeRef.current = false;
      }
    };

    map.on('dragstart', stopFollowMode);
    map.on('drag', stopFollowMode);
    map.on('zoomstart', (e: L.LeafletEvent) => {
      if ((e as any).originalEvent || !isProgrammaticMoveRef.current) {
        stopFollowMode(e);
      }
    });
    map.on('movestart', (e: L.LeafletEvent) => {
      if ((e as any).originalEvent) {
        stopFollowMode(e);
      }
    });

    // Deselect active client card when tapping an empty map area
    map.on('click', () => {
      if (selectedJobRef.current) {
        setClosedJobId(selectedJobRef.current.id);
      }
    });

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

  // Update map size on fullscreen toggle
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isFullscreen]);

  // Fit map bounds to view all route markers and reactivate follow mode
  const fitRouteBounds = () => {
    setIsFollowMode(true);
    isFollowModeRef.current = true;
    const map = mapInstanceRef.current;
    if (!map) return;

    const allCoords: [number, number][] = [];
    markersRef.current.forEach((m) => {
      const latLng = m.getLatLng();
      allCoords.push([latLng.lat, latLng.lng]);
    });

    if (allCoords.length > 0) {
      safeProgrammaticMove(() => {
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      });
    }
  };

  // Center map on user location and reactivate auto-follow mode
  const centerUserLocation = () => {
    setIsFollowMode(true);
    isFollowModeRef.current = true;
    const map = mapInstanceRef.current;
    if (!userLocation) {
      requestLocationPermission();
      return;
    }
    if (map) {
      safeProgrammaticMove(() => {
        map.flyTo([userLocation.lat, userLocation.lng], 15, { animate: true, duration: 1 });
      });
    }
  };

  // Render markers and polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    isProgrammaticCleanupRef.current = true;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    isProgrammaticCleanupRef.current = false;

    polylinesRef.current.forEach((p) => p.remove());
    polylinesRef.current = [];

    if (filteredJobs.length === 0 && !userLocation) return;

    const allBoundingCoords: [number, number][] = [];
    let colorIdx = 0;

    const now = new Date();
    const currentHourMin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    cleanerGroups.forEach(({ cleaner, cleanerName, jobs }, cleanerId) => {
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
          startLabel = `Casa de ${firstName}`;
        }
      }

      if (startLatLng) {
        routePoints.push(startLatLng);
        allBoundingCoords.push(startLatLng);

        const firstName = cleanerName.split(' ')[0] || cleanerName;
        const startHtml = isGpsActive
          ? `
            <div class="relative group cursor-pointer flex items-center justify-center">
              <div class="w-9 h-9 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 border-2 border-white shadow-xl flex items-center justify-center text-sm ring-4 ring-emerald-500/30 transition-transform duration-200 hover:scale-110">
                🚗
              </div>
              <span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-ping"></span>
              <span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white"></span>
            </div>
          `
          : `
            <div class="relative group cursor-pointer flex items-center justify-center">
              <div class="w-9 h-9 rounded-full bg-gradient-to-r ${palette.gradient} border-2 border-white shadow-xl flex items-center justify-center text-sm ring-2 ring-slate-900/10 transition-transform duration-200 hover:scale-110">
                🚗
              </div>
            </div>
          `;

        const startIcon = L.divIcon({
          html: startHtml,
          className: 'custom-cleaner-start-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const startMarker = L.marker(startLatLng, { icon: startIcon }).addTo(map);

        startMarker.bindTooltip(
          `<div class="font-black text-xs px-1 py-0.5">${firstName} • ${isGpsActive ? 'GPS Ativo' : 'Início'}</div>`,
          { direction: 'top', offset: [0, -18], className: 'custom-cleaner-tooltip' }
        );

        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${startLatLng[0]},${startLatLng[1]}`;

        startMarker.bindPopup(
          `
          <div class="p-2 font-sans text-xs space-y-1.5 min-w-[180px]">
            <div class="flex items-center gap-1.5 font-bold ${isGpsActive ? 'text-emerald-600' : 'text-blue-600'}">
              <span>🚗</span>
              <span>${isGpsActive ? 'GPS em Tempo Real' : 'Ponto de Partida / Residência'}</span>
            </div>
            <div class="font-black text-sm text-slate-900">${cleanerName}</div>
            <div class="text-[11px] text-slate-500">${isGpsActive ? 'Localização do Cleaner via GPS' : `${cleaner?.homeAddress || ''}, ${cleaner?.homePostcode || ''}`}</div>
            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mt-2 inline-flex items-center justify-center gap-1.5 w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold no-underline shadow-xs transition-colors">
              📍 Abrir no Google Maps
            </a>
          </div>
          `,
          { className: 'custom-modern-popup' }
        );

        startMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
        });

        markersRef.current.set(`start-${cleanerId}`, startMarker);
      }

      // Optimize route sequence
      const originPostcode = cleaner?.homePostcode || currentCompany.operationalBasePostcode || 'KT9 1BH';
      const originAddress = cleaner?.homeAddress || currentCompany.operationalBaseAddress || 'Hook Road, Chessington';
      const routeResult = optimizeRoute(
        originPostcode,
        originAddress,
        jobs,
        isGpsActive && userLocation ? userLocation : undefined
      );

      const firstNextJobId = routeResult.jobsInOrder.find((j) => j.status !== 'COMPLETED')?.id;

      routeResult.jobsInOrder.forEach((job, idx) => {
        const jobCoordsObj = getJobCoords(job);
        const jobLatLng: [number, number] = [jobCoordsObj.lat, jobCoordsObj.lng];

        routePoints.push(jobLatLng);
        allBoundingCoords.push(jobLatLng);

        const isSelected = selectedJob?.id === job.id;
        const isCompleted = job.status === 'COMPLETED';
        const isInProgress = job.status === 'IN_PROGRESS';
        const isNext = job.id === firstNextJobId && !isCompleted && !isInProgress;

        const isLate =
          !isCompleted &&
          !isInProgress &&
          job.startTime &&
          job.startTime < currentHourMin;

        let statusBg = palette.bg;
        let statusBadgeText = 'Agendado';
        let statusBorderColor = 'border-white';
        let ringEffect = '';

        if (isCompleted) {
          statusBg = 'bg-emerald-600';
          statusBadgeText = 'Concluído';
        } else if (isInProgress) {
          statusBg = 'bg-amber-600';
          statusBadgeText = 'Em Andamento';
          ringEffect = 'ring-4 ring-amber-500/50 animate-pulse';
        } else if (isLate) {
          statusBg = 'bg-rose-600';
          statusBadgeText = 'Atrasado';
          ringEffect = 'ring-4 ring-rose-500/50 animate-bounce';
        } else if (isNext) {
          statusBg = 'bg-blue-600';
          statusBadgeText = 'Próximo Atendimento';
          ringEffect = 'ring-4 ring-blue-500/40';
        }

        if (isSelected) {
          ringEffect = 'ring-4 ring-blue-600 scale-125 z-50';
        }

        const customHtml = `
          <div class="relative group cursor-pointer">
            <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs text-white shadow-xl border-2 ${statusBorderColor} ${statusBg} ${ringEffect} transition-all duration-200 hover:scale-110">
              #${idx + 1}
            </div>
            ${
              isCompleted
                ? '<div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-white flex items-center justify-center text-[8px] font-bold text-white">✓</div>'
                : ''
            }
          </div>
        `;

        const customIcon = L.divIcon({
          html: customHtml,
          className: 'custom-job-route-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker(jobLatLng, { icon: customIcon }).addTo(map);

        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          `${job.address}, ${job.postcode}`
        )}`;

        const val = routeResult.scheduleValidations?.[job.id];
        let delayBadgeHtml = '';
        if (val) {
          if (val.delayStatus === 'critical') {
            delayBadgeHtml = `<div class="mt-1 p-1 px-1.5 rounded bg-rose-100 text-rose-800 text-[9.5px] font-bold border border-rose-200">⚠️ Atraso Crítico: Chegada Est. ${val.estimatedArrivalTime} (+${val.delayMinutes}m)</div>`;
          } else if (val.delayStatus === 'warning') {
            delayBadgeHtml = `<div class="mt-1 p-1 px-1.5 rounded bg-amber-100 text-amber-800 text-[9.5px] font-bold border border-amber-200">⚠️ Atraso Leve: Chegada Est. ${val.estimatedArrivalTime} (+${val.delayMinutes}m)</div>`;
          } else {
            delayBadgeHtml = `<div class="mt-1 p-1 px-1.5 rounded bg-emerald-50 text-emerald-800 text-[9.5px] font-bold border border-emerald-100">✓ Chegada Est. ${val.estimatedArrivalTime} (Pontual)</div>`;
          }
        }

        marker.bindPopup(
          `
          <div class="p-2 font-sans text-xs space-y-2 min-w-[200px]">
            <div class="flex items-center justify-between">
              <span class="font-black text-[11px] px-2 py-0.5 rounded-full text-white ${statusBg}">
                #${idx + 1} ${statusBadgeText}
              </span>
              <span class="font-extrabold text-emerald-600 text-xs">£${job.price}</span>
            </div>

            <div class="space-y-0.5 pt-0.5">
              <div class="font-extrabold text-xs text-slate-900 leading-tight">${job.clientName}</div>
              <div class="text-[10px] text-slate-600 flex items-start gap-1">
                <span>📍</span>
                <span>${job.address}, ${job.postcode}</span>
              </div>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 p-1 rounded-lg border border-slate-100">
              <div>⏰ Agendado: <strong>${job.startTime}</strong> (${job.estimatedDuration}h)</div>
              <div>👤 <strong>${cleanerName.split(' ')[0]}</strong></div>
            </div>

            ${delayBadgeHtml}

            <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mt-1 flex items-center justify-center gap-1 w-full px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold no-underline shadow-xs transition-all active:scale-95">
              <span>📍</span>
              <span>Abrir no Google Maps</span>
            </a>
          </div>
          `,
          { className: 'custom-modern-popup' }
        );

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setClosedJobId(null);
          onSelectJob(job);
        });

        marker.on('popupclose', () => {
          if (!isProgrammaticCleanupRef.current && selectedJobRef.current?.id === job.id) {
            setClosedJobId(job.id);
          }
        });

        if (isSelected && closedJobId !== job.id) {
          marker.openPopup();
        }

        markersRef.current.set(job.id, marker);
      });

      // Draw polyline
      if (routePoints.length > 1) {
        const bgPolyline = L.polyline(routePoints, {
          color: '#0f172a',
          weight: 6,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        const polyline = L.polyline(routePoints, {
          color: isGpsActive ? '#059669' : palette.main,
          weight: 4,
          opacity: 0.95,
          dashArray: isGpsActive ? '8, 5' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        polylinesRef.current.push(bgPolyline, polyline);
      }
    });

    if (allBoundingCoords.length > 0) {
      if (!hasInitialFitRef.current) {
        hasInitialFitRef.current = true;
        safeProgrammaticMove(() => {
          const bounds = L.latLngBounds(allBoundingCoords);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
        });
      } else if (isFollowModeRef.current && userLocation) {
        safeProgrammaticMove(() => {
          map.panTo([userLocation.lat, userLocation.lng], { animate: true });
        });
      }
    }
  }, [filteredJobs, cleanerGroups, selectedCleanerId, selectedJob, userLocation, currentUser.id, isCleanerRole, closedJobId]);

  // Center map on selected job
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedJob) return;

    const coordsObj = getJobCoords(selectedJob);
    safeProgrammaticMove(() => {
      map.flyTo([coordsObj.lat, coordsObj.lng], 15, { animate: true, duration: 0.8 });
    });
  }, [selectedJob]);

  const cleanerList = Array.from(cleanerGroups.values());

  return (
    <div
      className={`relative w-full transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-slate-900 w-screen h-screen p-2 sm:p-3 rounded-none'
          : 'h-[460px] sm:h-[540px] rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-xl'
      }`}
    >
      {/* Map canvas container */}
      <div ref={mapContainerRef} className="w-full h-full z-0 rounded-2xl overflow-hidden" />

      {/* TOP COMPACT ROUTE OVERVIEW STRIP */}
      {showSummary && (
        <div className="absolute top-2.5 left-2.5 z-20 max-w-[calc(100%-180px)] sm:max-w-md animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md text-xs">
            <div className="flex items-center gap-1 font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-800 pr-2">
              <Route className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden xs:inline">{getTranslation(language, 'mapRoutesLabel')}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold truncate">
              <span><strong className="text-slate-900 dark:text-white">{routeMetrics.totalJobs}</strong> {getTranslation(language, 'mapJobsCount')}</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-blue-600 dark:text-blue-400">{routeMetrics.totalMiles} mi</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-purple-600 dark:text-purple-400">{routeMetrics.estimatedTimeHrs}h</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-emerald-600 dark:text-emerald-400">{routeMetrics.activeCleanersCount} cleaners</span>
            </div>
            <button
              onClick={() => setShowSummary(false)}
              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Re-open summary button */}
      {!showSummary && (
        <button
          onClick={() => setShowSummary(true)}
          className="absolute top-2.5 left-2.5 z-20 px-2.5 py-1 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 rounded-xl text-[11px] font-bold shadow-md backdrop-blur-md border border-slate-200 dark:border-slate-800 hover:bg-white flex items-center gap-1 transition-all cursor-pointer"
        >
          <Route className="w-3 h-3 text-blue-600" />
          <span>{getTranslation(language, 'mapSummaryTitle')}</span>
        </button>
      )}

      {/* TOP-RIGHT CONTROLS (GPS STATUS + FULLSCREEN BUTTON) */}
      <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5">
        {/* GPS Location Button */}
        {userLocation ? (
          <div className="px-2.5 py-1 bg-emerald-600/90 text-white rounded-xl text-[11px] font-bold shadow-md backdrop-blur-md flex items-center gap-1 border border-emerald-400">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <Navigation className="w-3 h-3" />
            <span className="hidden sm:inline">GPS Ao Vivo</span>
          </div>
        ) : (
          <button
            onClick={requestLocationPermission}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold shadow-md backdrop-blur-md flex items-center gap-1 border border-blue-400 transition-all cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            <span className="hidden sm:inline">Ativar GPS</span>
          </button>
        )}

        {/* Dedicated Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-lg backdrop-blur-md border border-slate-700 dark:border-slate-300 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="font-extrabold">{isFullscreen ? 'Sair' : 'Tela Cheia'}</span>
        </button>
      </div>

      {/* FLOATING ACTION BUTTONS (BOTTOM RIGHT) */}
      <div className="absolute bottom-3 right-2.5 z-20 flex flex-col gap-1.5">
        {/* Centralize Route */}
        <button
          onClick={fitRouteBounds}
          className="p-2 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl shadow-md backdrop-blur-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
        >
          <Route className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">{getTranslation(language, 'mapCenterBtn')}</span>
        </button>

        {/* GPS Center / Follow Mode Toggle */}
        <button
          onClick={centerUserLocation}
          className={`p-2 rounded-xl shadow-md backdrop-blur-md border transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
            isFollowMode && userLocation
              ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-500/30'
              : !isFollowMode
              ? 'bg-amber-500 text-slate-900 border-amber-400 ring-2 ring-amber-400/40 animate-pulse'
              : 'bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
          }`}
          title={isFollowMode ? 'Acompanhamento em tempo real ativo' : 'Navegação livre ativada. Toque para recentralizar.'}
        >
          <Crosshair className={`w-3.5 h-3.5 ${isFollowMode && userLocation ? 'text-white' : !isFollowMode ? 'text-slate-900' : 'text-slate-500'}`} />
          <span className="hidden sm:inline">
            {isFollowMode ? 'Acompanhando GPS' : getTranslation(language, 'mapGpsBtn')}
          </span>
        </button>

        {/* Legend Toggle */}
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`p-2 bg-white/95 dark:bg-slate-900/95 hover:bg-white dark:hover:bg-slate-800 rounded-xl shadow-md backdrop-blur-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold ${
            showLegend ? 'text-blue-600 ring-2 ring-blue-500/30' : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          <Info className="w-3.5 h-3.5 text-purple-600" />
          <span className="hidden sm:inline">{getTranslation(language, 'mapLegendBtn')}</span>
        </button>
      </div>

      {/* MAP LEGEND OVERLAY */}
      {showLegend && (
        <div className="absolute bottom-16 right-2.5 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-1.5 text-xs animate-in zoom-in-95 duration-150 max-w-xs">
          <div className="flex justify-between items-center pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="font-black text-slate-900 dark:text-white uppercase text-[9px] tracking-wider">
              {getTranslation(language, 'mapLegendTitle')}
            </span>
            <button
              onClick={() => setShowLegend(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-lg"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-600 text-white flex items-center justify-center text-[10px]">
                🚗
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{getTranslation(language, 'mapCleanerStart')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">
                ✓
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{getTranslation(language, 'mapCompleted')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[9px] font-bold">
                #
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{getTranslation(language, 'mapInProgress')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] font-bold">
                #
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{getTranslation(language, 'mapScheduledNext')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold">
                !
              </span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{getTranslation(language, 'mapOverdue')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN CLEANER SELECTOR TABS OVERLAY (BOTTOM LEFT) */}
      {!isCleanerRole && cleanerList.length > 0 && (
        <div className="absolute bottom-3 left-2.5 z-10 flex flex-wrap gap-1 max-w-[60%] sm:max-w-[65%]">
          <button
            onClick={() => onSelectCleaner && onSelectCleaner('ALL')}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold shadow-md backdrop-blur-md transition-all flex items-center gap-1 border cursor-pointer ${
              selectedCleanerId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-700'
                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-white'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {getTranslation(language, 'all')} ({filteredJobs.length})
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
                className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold shadow-md backdrop-blur-md transition-all flex items-center gap-1 border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-white'
                }`}
              >
                <span>{hasHome ? '🏠' : '⚠️'}</span>
                <span>
                  {firstName} ({jobs.length})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Warning Banner for Admin if cleaner lacks address */}
      {!isCleanerRole && missingAddressCleaners.length > 0 && (
        <div className="absolute top-12 left-2.5 right-2.5 sm:right-auto sm:max-w-md z-20 bg-amber-500/95 text-slate-900 backdrop-blur-md p-2 rounded-xl shadow-lg border border-amber-400 text-[11px] font-bold flex items-start gap-1.5 animate-in slide-in-from-top-2 duration-200">
          <AlertTriangle className="w-3.5 h-3.5 text-slate-900 shrink-0 mt-0.5" />
          <div>
            <span>
              <strong>{missingAddressCleaners.map((u) => u.name).join(', ')}</strong> {getTranslation(language, 'mapCleanerWithoutAddress')}
            </span>
          </div>
        </div>
      )}

      {/* SELECTED CLIENT OVERLAY CARD - ONLY SHOWS WHEN A MARKER IS CLICKED/SELECTED AND NOT CLOSED */}
      {currentJobToShow && (
        <div className="absolute bottom-12 right-2.5 left-2.5 sm:left-auto sm:max-w-xs z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl space-y-1.5 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex justify-between items-start">
            <div className="pr-2">
              <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                {getTranslation(language, 'mapSelectedClient')}
              </span>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                {currentJobToShow.clientName}
              </h4>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                £{currentJobToShow.price}
              </span>
              <button
                onClick={() => setClosedJobId(currentJobToShow.id)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="truncate">
              {currentJobToShow.address}, {currentJobToShow.postcode}
            </span>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" />
              <span>
                {currentJobToShow.startTime} ({currentJobToShow.estimatedDuration}h)
              </span>
            </div>
            {currentJobToShow.cleanerName && (
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <UserCheck className="w-3 h-3" />
                <span>{currentJobToShow.cleanerName.split(' ')[0]}</span>
              </div>
            )}
          </div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${currentJobToShow.address}, ${currentJobToShow.postcode}`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold no-underline shadow-xs transition-all active:scale-95 mt-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{getTranslation(language, 'mapOpenInGoogleMaps')}</span>
          </a>
        </div>
      )}
    </div>
  );
};

export const LiveRouteMap = React.memo(LiveRouteMapComponent);
