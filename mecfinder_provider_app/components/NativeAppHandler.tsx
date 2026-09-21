'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Main destinations. Back on any of these asks to exit (double-press), instead
// of navigating — like a native Android app. (Route-group "(main)" is not part
// of the URL, so these are the real paths.)
const ROOT_PAGES = ['/', '/login', '/dashboard', '/requests', '/services', '/wallet', '/profile'];

const EXIT_WINDOW_MS = 2000;

export default function NativeAppHandler() {
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
      const isRoot = ROOT_PAGES.includes(pathnameRef.current || '');

      // Sub-screen: navigate back through history like a native stack.
      if (!isRoot) {
        if (canGoBack) window.history.back();
        else App.exitApp();
        return;
      }

      // Root tab: require a second back press within the window to exit.
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

    App.addListener('backButton', handleBack).then((l) => {
      listener = l;
    });

    return () => {
      if (listener) listener.remove();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none ${
        showExitToast ? 'bottom-24 opacity-100' : 'bottom-16 opacity-0'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="bg-ink/90 text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-lg backdrop-blur whitespace-nowrap">
        Press back again to exit
      </div>
    </div>
  );
}
