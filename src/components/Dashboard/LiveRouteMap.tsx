import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CleaningJob } from '../../types';
import { Clock, MapPin } from 'lucide-react';

interface LiveRouteMapProps {
  todayJobs: CleaningJob[];
  selectedJob: CleaningJob | null;
  onSelectJob: (job: CleaningJob) => void;
}

// Coordinate mapping helper for London postcodes
function getCoordinatesForJob(job: CleaningJob, index: number): [number, number] {
  const code = (job.postcode || '').toUpperCase().trim();

  if (code.includes('SW1') || code.includes('SW1A')) return [51.501, -0.141];
  if (code.includes('EC1')) return [51.518, -0.099];
  if (code.includes('W1')) return [51.513, -0.132];
  if (code.includes('N1')) return [51.532, -0.106];
  if (code.includes('W8')) return [51.501, -0.192];
  if (code.includes('SE1')) return [51.504, -0.093];
  if (code.includes('E1')) return [51.520, -0.076];
  if (code.includes('KT9') || code.includes('KT19')) return [51.365 + index * 0.015, -0.312 + index * 0.01];

  // Spread around London center
  const baseLat = 51.5074;
  const baseLng = -0.1278;
  const latOffset = ((index * 37) % 100 - 50) * 0.002;
  const lngOffset = ((index * 53) % 100 - 50) * 0.003;
  return [baseLat + latOffset, baseLng + lngOffset];
}

const LiveRouteMapComponent: React.FC<LiveRouteMapProps> = ({
  todayJobs,
  selectedJob,
  onSelectJob,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);

  // Initialize map instance once
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

    // ResizeObserver for responsive canvas updates without layout trashing
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

  // Update markers and polyline when todayJobs change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean up existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (todayJobs.length === 0) return;

    const latLngs: [number, number][] = [];

    todayJobs.forEach((job, idx) => {
      const coords = getCoordinatesForJob(job, idx);
      latLngs.push(coords);

      const isSelected = selectedJob?.id === job.id;
      const isCompleted = job.status === 'COMPLETED';

      const customHtml = `
        <div class="relative group">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-lg transition-transform cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white border-white scale-110 ring-4 ring-blue-500/40'
              : isCompleted
              ? 'bg-emerald-600 text-white border-white'
              : 'bg-white text-slate-900 border-blue-600'
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

      const marker = L.marker(coords, { icon: customIcon }).addTo(map);

      marker.bindTooltip(
        `
        <div class="p-1 font-sans text-xs">
          <div class="font-bold text-blue-600">#${idx + 1} ${job.startTime}</div>
          <div class="font-extrabold text-slate-900">${job.clientName}</div>
          <div class="text-[10px] text-slate-500">${job.postcode}</div>
        </div>
        `,
        { direction: 'top', offset: [0, -10] }
      );

      marker.on('click', () => {
        onSelectJob(job);
      });

      markersRef.current.set(job.id, marker);
    });

    if (latLngs.length > 1) {
      polylineRef.current = L.polyline(latLngs, {
        color: '#10b981',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(map);
    }

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [todayJobs]);

  // Handle selectedJob highlighting and panning without destroying markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    todayJobs.forEach((job, idx) => {
      const marker = markersRef.current.get(job.id);
      if (!marker) return;

      const isSelected = selectedJob?.id === job.id;
      const isCompleted = job.status === 'COMPLETED';

      const customHtml = `
        <div class="relative group">
          <div class="w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-lg transition-transform cursor-pointer ${
            isSelected
              ? 'bg-blue-600 text-white border-white scale-110 ring-4 ring-blue-500/40'
              : isCompleted
              ? 'bg-emerald-600 text-white border-white'
              : 'bg-white text-slate-900 border-blue-600'
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

      marker.setIcon(customIcon);
    });

    if (selectedJob) {
      const idx = todayJobs.findIndex((j) => j.id === selectedJob.id);
      if (idx !== -1) {
        const coords = getCoordinatesForJob(selectedJob, idx);
        map.panTo(coords, { animate: true });
      }
    }
  }, [selectedJob, todayJobs]);

  return (
    <div className="relative w-full h-full min-h-[320px]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Floating Badge */}
      <div className="absolute top-3 left-3 z-10 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-2 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        London Central Area ({todayJobs.length} Stops)
      </div>

      {/* Selected Location Card Overlay */}
      {selectedJob && (
        <div className="absolute bottom-3 right-3 left-3 sm:left-auto sm:max-w-xs z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-2 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                SELECTED LOCATION
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
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Clock className="w-3 h-3 text-blue-500" />
            <span>{selectedJob.startTime} ({selectedJob.estimatedDuration} hrs)</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const LiveRouteMap = React.memo(LiveRouteMapComponent);
