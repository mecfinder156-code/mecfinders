'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { MapPin, Bell } from 'lucide-react';

const FLAG = 'permsOnboarded';

export default function PermissionsScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'location' | 'notification'>('location');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

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
      /* denial is OK */
    }
  };

  const requestNotifications = async () => {
    try {
      if (!Capacitor.isNativePlatform()) return;
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') await PushNotifications.register();
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

  const handleLocation = async (allow: boolean) => {
    setBusy(true);
    if (allow) await requestLocation();
    setBusy(false);
    setStep('notification');
  };

  const handleNotification = async (allow: boolean) => {
    setBusy(true);
    if (allow) await requestNotifications();
    await finish();
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isLocation = step === 'location';

  return (
    <div className="min-h-screen bg-cream flex flex-col px-6 pt-20 pb-8">
      <div className="flex items-center gap-2 mb-10">
        <span className={`h-1.5 rounded-full transition-all ${isLocation ? 'w-8 bg-primary' : 'w-4 bg-primary'}`} />
        <span className={`h-1.5 rounded-full transition-all ${isLocation ? 'w-4 bg-black/10' : 'w-8 bg-primary'}`} />
      </div>

      <div className="flex-1 flex flex-col items-center text-center">
        <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary-tint text-primary">
          {isLocation ? <MapPin className="h-11 w-11" strokeWidth={1.6} /> : <Bell className="h-11 w-11" strokeWidth={1.6} />}
        </div>
        <h1 className="text-[26px] font-extrabold text-ink tracking-tight leading-tight">
          {isLocation ? 'Enable Location' : 'Enable Notifications'}
        </h1>
        <p className="mt-2 text-[14px] text-ink/55 font-medium max-w-[300px]">
          {isLocation
            ? 'We use your location to send you the nearest jobs and let customers track you live.'
            : 'So you never miss a new service request, even when the app is in the background.'}
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => (isLocation ? handleLocation(true) : handleNotification(true))}
          disabled={busy}
          className="w-full rounded-2xl bg-primary py-4 text-white font-bold text-[16px] active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {busy ? 'Please wait…' : isLocation ? 'Allow Location' : 'Allow Notifications'}
        </button>
        <button
          onClick={() => (isLocation ? handleLocation(false) : handleNotification(false))}
          disabled={busy}
          className="w-full py-2 font-bold text-sm text-ink/50 disabled:opacity-60"
        >
          {isLocation ? 'Not now' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
