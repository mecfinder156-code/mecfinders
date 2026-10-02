"use client";

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LiveTrackingMapProps {
  mechanic: LatLng | null;
  customer: LatLng | null;
  statusText?: string;
}

/**
 * Interactive live map (Leaflet + OpenStreetMap tiles).
 *
 * Pan/zoom works (unlike the old Static Maps image), needs no Google key (OSM
 * tiles have no referrer restriction, so they load fine inside the WebView),
 * and shows both parties as pins (M = mechanic, C = customer) with a line
 * between them. The view auto-fits once; after that the user can freely drag it.
 */
export default function LiveTrackingMap({ mechanic, customer }: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const mechMarker = useRef<any>(null);
  const custMarker = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const fitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default as any;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const c = mechanic || customer || { latitude: 20.5937, longitude: 78.9629 };
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false }).setView(
        [c.latitude, c.longitude],
        14
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
      syncMarkers();
      // Leaflet needs a correct container size; it mounts inside an absolute
      // box so nudge it after layout settles.
      setTimeout(() => map.invalidateSize(), 150);
      setTimeout(() => map.invalidateSize(), 500);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanic?.latitude, mechanic?.longitude, customer?.latitude, customer?.longitude]);

  function pin(color: string, label: string) {
    const L = LRef.current;
    return L.divIcon({
      className: '',
      html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;">
               <span style="transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px;">${label}</span>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
  }

  function syncMarkers() {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (mechanic) {
      const ll = [mechanic.latitude, mechanic.longitude];
      if (!mechMarker.current) mechMarker.current = L.marker(ll, { icon: pin('#6D1B2C', 'M') }).addTo(map);
      else mechMarker.current.setLatLng(ll);
    }
    if (customer) {
      const ll = [customer.latitude, customer.longitude];
      if (!custMarker.current) custMarker.current = L.marker(ll, { icon: pin('#131F33', 'C') }).addTo(map);
      else custMarker.current.setLatLng(ll);
    }
    if (mechanic && customer) {
      const pts = [
        [mechanic.latitude, mechanic.longitude],
        [customer.latitude, customer.longitude],
      ];
      if (!lineRef.current) lineRef.current = L.polyline(pts, { color: '#6D1B2C', weight: 4, opacity: 0.7 }).addTo(map);
      else lineRef.current.setLatLngs(pts);
    }

    // Fit both points into view ONCE; afterwards leave the user's pan/zoom alone.
    if (!fitted.current) {
      if (mechanic && customer) {
        map.fitBounds(
          [
            [mechanic.latitude, mechanic.longitude],
            [customer.latitude, customer.longitude],
          ],
          { padding: [60, 60], maxZoom: 16 }
        );
        fitted.current = true;
      } else if (mechanic || customer) {
        const p = mechanic || customer;
        map.setView([p!.latitude, p!.longitude], 15);
      }
    }
  }

  return <div ref={containerRef} className="w-full h-full" style={{ background: '#EEF2F6' }} />;
}

