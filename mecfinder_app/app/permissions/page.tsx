"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const FLAG = 'permsOnboarded';

export default function PermissionsScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'location' | 'notification'>('location');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already onboarded? Skip straight to the app.
  useEffect(() => {
    (async () => {
      try {
        const { value } = await Preferences.get({ key: FLAG });
        if (value === '1') {
          router.replace('/dashboard');
          return;
        }
      } catch {
        /* ignore */
      }
      setChecking(false);
    })();
  }, [router]);

  const requestLocation = async () => {
    try {
      if (!Capacitor.isNativePlatform()) return;
      const { Geolocation } = await import('@capacitor/geolocation');
      await Geolocation.requestPermissions({ permissions: ['location'] });
    } catch {
      /* denial is OK — we continue regardless */
    }
  };

  const requestNotifications = async () => {
    try {
      if (!Capacitor.isNativePlatform()) return;
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.requestPermissions();
    } catch {
      /* denial is OK */
    }
  };

  const finish = async () => {
    try {
      await Preferences.set({ key: FLAG, value: '1' });
    } catch {
      /* ignore */
    }
    router.replace('/dashboard');
  };

  // Step 1 (location) → request, then move to the notification step.
  const handleLocation = async (allow: boolean) => {
    setBusy(true);
    if (allow) await requestLocation();
    setBusy(false);
    setStep('notification');
  };

  // Step 2 (notification) → request, then into the app.
  const handleNotification = async (allow: boolean) => {
    setBusy(true);
    if (allow) await requestNotifications();
    await finish();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD]">
        <div className="w-8 h-8 border-[3px] border-[#6D1B2C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLocation = step === 'location';

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col px-6 pt-20 pb-8">
      {/* step dots */}
      <div className="flex items-center gap-2 mb-10">
        <span className={`h-1.5 rounded-full transition-all ${isLocation ? 'w-8 bg-[#6D1B2C]' : 'w-4 bg-[#6D1B2C]'}`} />
        <span className={`h-1.5 rounded-full transition-all ${isLocation ? 'w-4 bg-gray-200' : 'w-8 bg-[#6D1B2C]'}`} />
      </div>

      <div className="flex-1 flex flex-col items-center text-center">
        <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#FFF0F2] text-[#6D1B2C]">
          {isLocation ? (
            <svg className="w-11 h-11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          ) : (
            <svg className="w-11 h-11" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          )}
        </div>
        <h1 className="text-[26px] font-black text-[#131F33] tracking-tight leading-tight">
          {isLocation ? 'Enable Location' : 'Enable Notifications'}
        </h1>
        <p className="mt-2 text-[14px] text-gray-500 font-medium max-w-[300px]">
          {isLocation
            ? 'We use your location to find mechanics near you and show them live on the map while they reach you.'
            : "We'll notify you when a mechanic is assigned, arrives, and when your service is done."}
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => (isLocation ? handleLocation(true) : handleNotification(true))}
          disabled={busy}
          className="w-full bg-[#6D1B2C] text-white rounded-[18px] h-[54px] font-bold text-[16px] flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {busy ? 'Please wait…' : isLocation ? 'Allow Location' : 'Allow Notifications'}
        </button>
        <button
          onClick={() => (isLocation ? handleLocation(false) : handleNotification(false))}
          disabled={busy}
          className="w-full text-gray-500 font-bold text-[14px] py-2 disabled:opacity-60"
        >
          {isLocation ? 'Not now' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
