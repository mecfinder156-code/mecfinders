"use client";

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { runTopBackHandler } from '../lib/backButton';

// Main tab destinations. Pressing back on any of these does NOT navigate —
// it asks to exit the app (double-press to confirm), like a native Android app.
const ROOT_PAGES = ['/', '/login', '/dashboard', '/profile', '/bookings', '/search', '/chat'];

const EXIT_WINDOW_MS = 2000;

export default function HardwareBackButtonHandler() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const lastBackPressRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any = null;

    const handleBack = ({ canGoBack }: { canGoBack: boolean }) => {
      // 1. An overlay (modal / bottom sheet) is open — let it close itself.
      if (runTopBackHandler()) return;

      const isRoot = ROOT_PAGES.includes(pathnameRef.current || '');

      // 2. On a sub-screen, go back through history like a native stack.
      if (!isRoot) {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
        return;
      }

      // 3. On a main tab, require a second back press to actually exit.
      const now = Date.now();
      if (now - lastBackPressRef.current < EXIT_WINDOW_MS) {
        App.exitApp();
        return;
      }
      lastBackPressRef.current = now;
      setShowExitToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowExitToast(false), EXIT_WINDOW_MS);
    };

    const setupListener = async () => {
      listener = await App.addListener('backButton', handleBack);
    };

    setupListener();

    return () => {
      if (listener) listener.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []); // Run only once

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none ${
        showExitToast ? 'bottom-24 opacity-100' : 'bottom-16 opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-gray-900/90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg backdrop-blur whitespace-nowrap">
        Press back again to exit
      </div>
    </div>
  );
}
