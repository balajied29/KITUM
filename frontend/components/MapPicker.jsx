'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { reverseGeocode } from '@/lib/maps';
import PlacesAutocomplete from '@/components/PlacesAutocomplete';

const DEFAULT = { lat: 25.5788, lng: 91.8933 }; // Shillong
const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; OpenStreetMap contributors';

/**
 * Rapido/Uber-style location picker, rendered with Leaflet + OpenStreetMap
 * raster tiles (no WebGL, no token, bundled — far more robust than Mapbox GL).
 * A fixed centre pin sits over the map; the map centre is reverse-geocoded.
 * Search + "locate me" jump the map. Calls onConfirm({ lat, lng, address }).
 */
export default function MapPicker({ initial, onConfirm, confirmLabel = 'Confirm location', busy, children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const reverseTimer = useRef(null);

  const start = initial?.lat ? { lat: initial.lat, lng: initial.lng } : DEFAULT;
  const [center, setCenter] = useState(start);
  const [address, setAddress] = useState(initial?.address || '');
  const [moving, setMoving] = useState(false);
  const [locating, setLocating] = useState(!initial?.lat);
  const [mapError, setMapError] = useState('');

  const doReverse = (lat, lng) => {
    clearTimeout(reverseTimer.current);
    reverseTimer.current = setTimeout(async () => {
      const a = await reverseGeocode(lat, lng);
      if (a) setAddress(a);
    }, 300);
  };

  // Move the map (search result / locate-me). `addr` set for search results.
  const fly = (lat, lng, zoom = 16, addr) => {
    setCenter({ lat, lng });
    if (addr) setAddress(addr);
    else doReverse(lat, lng);
    if (mapRef.current) mapRef.current.flyTo([lat, lng], zoom, { duration: 0.8 });
  };

  useEffect(() => {
    let cancelled = false;
    let ro;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
          [start.lat, start.lng],
          15
        );
        mapRef.current = map;
        L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
        L.control.zoom({ position: 'bottomleft' }).addTo(map);

        map.on('movestart', () => setMoving(true));
        map.on('moveend', () => {
          setMoving(false);
          const c = map.getCenter();
          setCenter({ lat: c.lat, lng: c.lng });
          doReverse(c.lat, c.lng);
        });

        // Container can size after init — keep the tiles filling the box.
        setTimeout(() => map.invalidateSize(), 200);
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => map.invalidateSize());
          ro.observe(containerRef.current);
        }

        // Initial address + accurate auto-locate (unless editing a fixed point).
        if (initial?.lat) {
          if (!initial.address) doReverse(start.lat, start.lng);
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              setLocating(false);
              fly(pos.coords.latitude, pos.coords.longitude, 16);
            },
            () => {
              if (cancelled) return;
              setLocating(false);
              doReverse(start.lat, start.lng);
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
          );
        } else {
          setLocating(false);
          doReverse(start.lat, start.lng);
        }
      } catch (e) {
        if (!cancelled) setMapError(e?.message || 'Map failed to load');
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(reverseTimer.current);
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        fly(pos.coords.latitude, pos.coords.longitude, 16);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="absolute inset-0 bg-slate-100" />

        {mapError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-8 text-center bg-slate-100">
            <p className="text-sm font-700 text-text-main">Map couldn’t load</p>
            <p className="text-xs text-text-muted">{mapError}. You can still search above or use your current location.</p>
          </div>
        )}

        {/* Search */}
        <div className="absolute top-3 left-3 right-3 z-[1000] rounded-input shadow-lg">
          <PlacesAutocomplete placeholder="Search area, street, landmark…" onSelect={(p) => fly(p.lat, p.lng, 16, p.address)} />
        </div>

        {/* Finding-your-location chip */}
        {locating && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-chip shadow-lg px-3 py-1.5 flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <span className="text-xs font-medium text-text-main">Finding your location…</span>
          </div>
        )}

        {/* Centre pin */}
        <div
          className="absolute left-1/2 top-1/2 z-[800] pointer-events-none"
          style={{ transform: `translate(-50%, ${moving ? -115 : -100}%)`, transition: 'transform .15s ease' }}
        >
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
            <path d="M17 0C7.6 0 0 7.6 0 17c0 11.9 17 27 17 27s17-15.1 17-27C34 7.6 26.4 0 17 0z" fill="#0037b0" />
            <circle cx="17" cy="16" r="6" fill="#fff" />
          </svg>
        </div>
        <div className="absolute left-1/2 top-1/2 z-[800] w-2.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-black/25 pointer-events-none" />

        {/* Locate me */}
        <button
          onClick={locateMe}
          className="absolute right-3 bottom-3 z-[1000] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Use my current location"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8a4 4 0 100 8 4 4 0 000-8z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3m0 14v3m10-10h-3M5 12H2" />
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <div className="bg-white rounded-t-card -mt-3 relative z-[1000] px-4 pt-4 pb-5 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <p className="text-[10px] font-700 text-text-muted uppercase tracking-widest mb-2">Delivering to</p>
        <div className="flex items-start gap-2 mb-3">
          <svg className="mt-0.5 shrink-0" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <circle cx="12" cy="11" r="3" />
          </svg>
          <p className="text-sm font-medium text-text-main leading-snug flex-1">
            {moving ? 'Move the map to set your location…' : address || 'Locating…'}
          </p>
        </div>

        {children}

        <button
          onClick={() => onConfirm({ lat: center.lat, lng: center.lng, address })}
          disabled={busy || !address || moving}
          className="btn-primary w-full py-3 mt-3 disabled:opacity-50"
        >
          {busy ? 'Saving…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
