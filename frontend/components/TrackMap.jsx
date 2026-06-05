'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '&copy; OpenStreetMap contributors';

const dropIcon = (L) =>
  L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#0037b0;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const tankerIcon = (L) =>
  L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid #0037b0;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0037b0" stroke-width="2"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="1.5"/><circle cx="18.5" cy="18.5" r="1.5"/></svg>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

/**
 * Live tracking map (Leaflet + OpenStreetMap). Shows the drop point and an
 * animated tanker marker. Props: drop { lat, lng }, tanker { lat, lng } | null.
 */
export default function TrackMap({ drop, tanker }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const LRef = useRef(null);
  const tankerRef = useRef(null);
  const animRef = useRef(null);

  // Init map + drop marker.
  useEffect(() => {
    let cancelled = false;
    let ro;
    if (!drop?.lat) return;
    (async () => {
      try {
        const L = (await import('leaflet')).default;
        if (cancelled || !containerRef.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(
          [drop.lat, drop.lng],
          14
        );
        mapRef.current = map;
        L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTR }).addTo(map);
        L.marker([drop.lat, drop.lng], { icon: dropIcon(L) }).addTo(map);
        setTimeout(() => map.invalidateSize(), 200);
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => map.invalidateSize());
          ro.observe(containerRef.current);
        }
      } catch {
        /* tiles/map failed — leave the gradient fallback visible */
      }
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      tankerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop?.lat, drop?.lng]);

  // Move the tanker marker smoothly and keep both points in view.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !tanker?.lat) return;

    if (!tankerRef.current) {
      tankerRef.current = L.marker([tanker.lat, tanker.lng], { icon: tankerIcon(L) }).addTo(map);
    } else {
      const from = tankerRef.current.getLatLng();
      const to = { lat: tanker.lat, lng: tanker.lng };
      const startT = performance.now();
      const dur = 800;
      cancelAnimationFrame(animRef.current);
      const step = (now) => {
        const t = Math.min(1, (now - startT) / dur);
        tankerRef.current.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
        if (t < 1) animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }

    try {
      map.fitBounds([[drop.lat, drop.lng], [tanker.lat, tanker.lng]], { padding: [60, 60], maxZoom: 16 });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanker?.lat, tanker?.lng]);

  return <div ref={containerRef} className="w-full h-full bg-gradient-to-b from-blue-50 to-slate-100" />;
}
