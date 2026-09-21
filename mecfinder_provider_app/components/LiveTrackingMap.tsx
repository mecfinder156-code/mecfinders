"use client";

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { loadGoogleMaps, isMapsConfigured } from '@/lib/googleMaps';

interface LatLng {
  latitude: number;
  longitude: number;
}

interface LiveTrackingMapProps {
  /** The mechanic's own live position (this device). */
  self: LatLng | null;
  /** The customer / job destination. */
  destination: LatLng | null;
  statusText?: string;
}

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/**
 * Provider-side navigation map. Shows the mechanic's own live position and the
 * customer's destination so they can see where they're heading. Native Maps SDK
 * on device (`@capacitor/google-maps`), JS API fallback on web, friendly
 * placeholder when the key is missing / SDK fails.
 */
export default function LiveTrackingMap({ self, destination, statusText }: LiveTrackingMapProps) {
  return Capacitor.isNativePlatform() ? (
    <NativeMap self={self} destination={destination} statusText={statusText} />
  ) : (
    <WebMap self={self} destination={destination} statusText={statusText} />
  );
}

/* ---------------- Native (device) ---------------- */

function NativeMap({ self, destination, statusText }: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const selfMarkerId = useRef<string | null>(null);
  const destMarkerId = useRef<string | null>(null);
  const readyRef = useRef(false);
  const [failed, setFailed] = useState(!MAPS_API_KEY);

  useEffect(() => {
    if (!MAPS_API_KEY || !containerRef.current) {
      setFailed(true);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const { GoogleMap } = await import('@capacitor/google-maps');
        const center = self || destination || { latitude: 20.5937, longitude: 78.9629 };
        const map = await GoogleMap.create({
          id: 'provider-tracking-map',
          element: containerRef.current as HTMLElement,
          apiKey: MAPS_API_KEY,
          forceCreate: true,
          config: { center: { lat: center.latitude, lng: center.longitude }, zoom: 14 },
        });
        if (cancelled) {
          await map.destroy();
          return;
        }
        mapRef.current = map;
        readyRef.current = true;
        await sync();
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

  useEffect(() => {
    if (readyRef.current) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self?.latitude, self?.longitude, destination?.latitude, destination?.longitude]);

  async function sync() {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (destination && !destMarkerId.current) {
        destMarkerId.current = await map.addMarker({
          coordinate: { lat: destination.latitude, lng: destination.longitude },
          title: 'Customer',
          tintColor: { r: 19, g: 31, b: 51, a: 1 },
        });
      }
      if (self) {
        if (selfMarkerId.current) {
          await map.removeMarker(selfMarkerId.current).catch(() => {});
          selfMarkerId.current = null;
        }
        selfMarkerId.current = await map.addMarker({
          coordinate: { lat: self.latitude, lng: self.longitude },
          title: 'You',
          tintColor: { r: 109, g: 27, b: 44, a: 1 },
        });
        await map.setCamera({
          coordinate: { lat: self.latitude, lng: self.longitude },
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
      /* best-effort */
    }
  }

  if (failed) return <MapFallback self={self} statusText={statusText} />;
  return <div ref={containerRef} className="w-full h-full bg-transparent" />;
}

/* ---------------- Web fallback ---------------- */

function WebMap({ self, destination, statusText }: LiveTrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const selfMarkerRef = useRef<any>(null);
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
        const center = self || destination || { latitude: 20.5937, longitude: 78.9629 };
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
          position: pos, map, title: 'Customer',
          icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#131F33', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
        });
      } else {
        destMarkerRef.current.setPosition(pos);
      }
    }
    if (self) {
      const pos = { lat: self.latitude, lng: self.longitude };
      if (!selfMarkerRef.current) {
        selfMarkerRef.current = new maps.Marker({
          position: pos, map, title: 'You',
          icon: { path: maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#6D1B2C', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
        });
      } else {
        selfMarkerRef.current.setPosition(pos);
      }
    }
    if (self && destination) {
      const bounds = new maps.LatLngBounds();
      bounds.extend({ lat: self.latitude, lng: self.longitude });
      bounds.extend({ lat: destination.latitude, lng: destination.longitude });
      map.fitBounds(bounds, 80);
    } else if (self) {
      map.panTo({ lat: self.latitude, lng: self.longitude });
    } else if (destination) {
      map.panTo({ lat: destination.latitude, lng: destination.longitude });
    }
  }, [self, destination]);

  if (failed) return <MapFallback self={self} statusText={statusText} />;
  return <div ref={containerRef} className="w-full h-full" />;
}

function MapFallback({ self, statusText }: { self: LatLng | null; statusText?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#E9E4D8] text-center px-6">
      <div className="text-4xl mb-2">🗺️</div>
      <p className="text-[13px] font-bold text-ink">{statusText || 'Navigating to customer'}</p>
      <p className="text-[11px] text-ink/50 font-medium mt-1">
        {self ? 'Your live location is on.' : 'Turn on location to see the route.'}
      </p>
    </div>
  );
}
