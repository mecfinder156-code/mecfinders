"use client";

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Tracks connectivity. On a device it uses the native `@capacitor/network`
 * plugin; on the web it falls back to `navigator.onLine` + online/offline
 * events. Starts optimistic (`true`) so it never flashes offline on first paint.
 */
export function useNetwork(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOnline(s.connected);
          });
          cleanup = () => handle.remove();
        } catch {
          setOnline(true);
        }
      })();
    } else {
      const update = () => setOnline(navigator.onLine);
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      cleanup = () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  return online;
}
