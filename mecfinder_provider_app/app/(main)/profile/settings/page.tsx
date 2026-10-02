'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Globe, Shield } from 'lucide-react';
import { Preferences } from '@capacitor/preferences';

export default function SettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);

  useEffect(() => {
    // Load preferences
    const loadSettings = async () => {
      const pushStr = await Preferences.get({ key: 'pushEnabled' });
      if (pushStr.value === 'false') {
        setPushEnabled(false);
      }
    };
    loadSettings();
  }, []);

  const togglePush = async () => {
    const newVal = !pushEnabled;
    setPushEnabled(newVal);
    await Preferences.set({ key: 'pushEnabled', value: newVal.toString() });
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 transition-colors active:bg-black/[0.05]"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <h1 className="text-xl font-extrabold text-ink">General Settings</h1>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {/* Push Notifications Toggle */}
          <div className="flex items-center justify-between border-b border-black/[0.05] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
                <Bell className="h-4.5 w-4.5" />
              </span>
              <span className="font-semibold text-ink">Push Notifications</span>
            </div>
            <button
              onClick={togglePush}
              aria-label="Toggle push notifications"
              className={`flex h-7 w-12 items-center rounded-full px-1 transition-colors ${pushEnabled ? 'bg-primary' : 'bg-black/15'}`}
            >
              <div className={`h-5 w-5 transform rounded-full bg-white shadow transition-transform ${pushEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <button className="flex w-full items-center justify-between border-b border-black/[0.05] p-4 text-left transition-colors active:bg-black/[0.03]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
                <Globe className="h-4.5 w-4.5" />
              </span>
              <span className="font-semibold text-ink">Language</span>
            </div>
            <div className="flex items-center gap-1.5 text-ink/45">
              <span className="text-sm font-medium">English</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>

          <button className="flex w-full items-center justify-between p-4 text-left transition-colors active:bg-black/[0.03]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
                <Shield className="h-4.5 w-4.5" />
              </span>
              <span className="font-semibold text-ink">Privacy Settings</span>
            </div>
            <ChevronRight className="h-4 w-4 text-ink/45" />
          </button>
        </div>
        <p className="mt-6 text-center text-xs font-medium text-ink/45">
          Settings are saved automatically on your device.
        </p>
      </div>
    </div>
  );
}
