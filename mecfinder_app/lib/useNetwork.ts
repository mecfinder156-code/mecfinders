"use client";

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Tracks connectivity. On a device it uses the native `@capacitor/network`
 * plugin (reliable, fires on airplane-mode / wifi drops); on the web it falls
 * back to the browser's `navigator.onLine` + online/offline events.
 *
 * Starts optimistic (`true`) so a momentary check never flashes the offline
 * screen on first paint.
 */
export function useNetwork(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let removeNative: (() => void) | null = null;

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOnline(s.connected);
          });
          removeNative = () => handle.remove();
        } catch {
          setOnline(true); // never lock the user out on a plugin error
        }
      })();
    } else {
      const update = () => setOnline(navigator.onLine);
      update();
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      removeNative = () => {
        window.removeEventListener('online', update);
        window.removeEventListener('offline', update);
      };
    }

    return () => {
      if (removeNative) removeNative();
    };
  }, []);

  return online;
}
