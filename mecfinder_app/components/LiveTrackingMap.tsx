"use client";

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { loadGoogleMaps, isMapsConfigured } from '@/lib/googleMaps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LiveTrackingMapProps {
  mechanic: LatLng | null;
  destination: LatLng | null;
  /** Label shown on the map fallback / status line. */
  statusText?: string;
}

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Rapido-style live map.
 *
 * On a real device (Capacitor native) this renders the **native** Google Maps
 * SDK via `@capacitor/google-maps` — the map is a native view drawn behind the
 * webview, so it pans and zooms at 60fps like Uber/Rapido. On the web (dev
 * preview / browser build) it falls back to the Google Maps JS API so the
 * screen still works everywhere.
 *
 * The mechanic marker moves in real time as new `mechanic` props arrive from the
 * socket stream; the destination marker (customer location) stays put. Both
 * paths degrade to a friendly placeholder when the key isn't configured or the
 * SDK fails to load, so the tracking screen never breaks.
 */
export default function LiveTrackingMap({ mechanic, destination, statusText }: LiveTrackingMapProps) {
  const isNative = Capacitor.isNativePlatform();
  return isNative ? (
    <NativeMap mechanic={mechanic} destination={destination} statusText={statusText} />
  ) : (
    <WebMap mechanic={mechanic} destination={destination} statusText={statusText} />
  );
}

/* ------------------------------------------------------------------ */
/* Native (device) — @capacitor/google-maps                            */
/* ------------------------------------------------------------------ */

function NativeMap({ mechanic, destination, statusText }: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mechMarkerId = useRef<string | null>(null);
  const destMarkerId = useRef<string | null>(null);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(!MAPS_API_KEY);

  // Create the native map once.
  useEffect(() => {
    if (!MAPS_API_KEY || !containerRef.current) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const { GoogleMap } = await import('@capacitor/google-maps');
        const center = mechanic || destination || { latitude: 20.5937, longitude: 78.9629 };
        const map = await GoogleMap.create({
          id: 'live-tracking-map',
          element: containerRef.current as HTMLElement,
          apiKey: MAPS_API_KEY,
          forceCreate: true,
          config: {
            center: { lat: center.latitude, lng: center.longitude },
            zoom: 14,
          },
        });
        if (cancelled) {
          await map.destroy();
          return;
        }
        mapRef.current = map;
        readyRef.current = true;
        await syncNativeMarkers();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      const m = mapRef.current;
      mapRef.current = null;
      if (m) m.destroy().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync markers + camera whenever a position changes.
  useEffect(() => {
    if (readyRef.current) syncNativeMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mechanic?.latitude, mechanic?.longitude, destination?.latitude, destination?.longitude]);

  async function syncNativeMarkers() {
    const map = mapRef.current;
    if (!map) return;
    try {
      // Destination marker — created once.
      if (destination && !destMarkerId.current) {
        destMarkerId.current = await map.addMarker({
          coordinate: { lat: destination.latitude, lng: destination.longitude },
          title: 'Your location',
          tintColor: { r: 19, g: 31, b: 51, a: 1 },
        });
      }
      // Mechanic marker — native markers can't be moved in place, so re-add.
      if (mechanic) {
        if (mechMarkerId.current) {
          await map.removeMarker(mechMarkerId.current).catch(() => {});
          mechMarkerId.current = null;
        }
        mechMarkerId.current = await map.addMarker({
          coordinate: { lat: mechanic.latitude, lng: mechanic.longitude },
          title: 'Mechanic',
          tintColor: { r: 109, g: 27, b: 44, a: 1 },
        });
      }
      // Keep the relevant point(s) in view.
      if (mechanic) {
        await map.setCamera({
          coordinate: { lat: mechanic.latitude, lng: mechanic.longitude },
          zoom: destination ? 13 : 15,
          animate: true,
        });
      } else if (destination) {
        await map.setCamera({
          coordinate: { lat: destination.latitude, lng: destination.longitude },
          zoom: 15,
          animate: true,
        });
      }
    } catch {
      /* best-effort: never break the screen over a marker error */
    }
  }

  if (failed) return <MapFallback mechanic={mechanic} statusText={statusText} />;

  // The wrapper MUST stay transparent — the native map is drawn behind the
  // webview and shows through this element's rectangle.
  return <div ref={containerRef} className="w-full h-full bg-transparent" />;
}

/* ------------------------------------------------------------------ */
/* Web (browser / dev preview) — Google Maps JS API                    */
/* ------------------------------------------------------------------ */

function WebMap({ mechanic, destination, statusText }: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const mechanicMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const mapsRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isMapsConfigured()) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const center = mechanic || destination || { latitude: 20.5937, longitude: 78.9629 };
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    if (destination) {
      const pos = { lat: destination.latitude, lng: destination.longitude };
      if (!destMarkerRef.current) {
        destMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: 'Your location',
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#131F33',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });
      } else {
        destMarkerRef.current.setPosition(pos);
      }
    }

    if (mechanic) {
      const pos = { lat: mechanic.latitude, lng: mechanic.longitude };
      if (!mechanicMarkerRef.current) {
        mechanicMarkerRef.current = new maps.Marker({
          position: pos,
          map,
          title: 'Mechanic',
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
            fillColor: '#6D1B2C',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: 1.6,
            anchor: new maps.Point(12, 22),
          },
        });
      } else {
        mechanicMarkerRef.current.setPosition(pos);
      }
    }

    if (mechanic && destination) {
      const bounds = new maps.LatLngBounds();
      bounds.extend({ lat: mechanic.latitude, lng: mechanic.longitude });
      bounds.extend({ lat: destination.latitude, lng: destination.longitude });
      map.fitBounds(bounds, 80);
    } else if (mechanic) {
      map.panTo({ lat: mechanic.latitude, lng: mechanic.longitude });
    } else if (destination) {
      map.panTo({ lat: destination.latitude, lng: destination.longitude });
    }
  }, [mechanic, destination]);

  if (failed) return <MapFallback mechanic={mechanic} statusText={statusText} />;

  return <div ref={containerRef} className="w-full h-full" />;
}

/* ------------------------------------------------------------------ */

function MapFallback({ mechanic, statusText }: { mechanic: LatLng | null; statusText?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#EEF2F6] text-center px-6">
      <div className="text-4xl mb-2">🗺️</div>
      <p className="text-[13px] font-bold text-[#131F33]">{statusText || 'Mechanic is on the way'}</p>
      <p className="text-[11px] text-gray-500 font-medium mt-1">
        {mechanic ? 'Live location updating…' : 'Waiting for the mechanic to start sharing location.'}
      </p>
    </div>
  );
}
