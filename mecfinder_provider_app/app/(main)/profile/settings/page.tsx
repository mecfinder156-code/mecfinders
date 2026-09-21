'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ChevronLeft, Bell, Globe, Shield } from 'lucide-react';
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
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm transition-colors">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 ml-2">General Settings</h1>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-colors">
          {/* Push Notifications Toggle */}
          <div className="p-4 flex items-center justify-between border-b border-gray-50">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-gray-400 mr-3" />
              <span className="font-medium text-gray-700">Push Notifications</span>
            </div>
            <button 
              onClick={togglePush}
              className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${pushEnabled ? 'bg-primary' : 'bg-gray-200'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transform transition-transform ${pushEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between border-b border-gray-50 cursor-pointer hover:bg-gray-50">
            <div className="flex items-center">
              <Globe className="h-5 w-5 text-gray-400 mr-3" />
              <span className="font-medium text-gray-700">Language</span>
            </div>
            <div className="flex items-center text-gray-400">
              <span className="text-sm mr-2">English</span>
              <ChevronLeft className="h-4 w-4 transform rotate-180" />
            </div>
          </div>

          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-gray-400 mr-3" />
              <span className="font-medium text-gray-700">Privacy Settings</span>
            </div>
            <div className="flex items-center text-gray-400">
              <ChevronLeft className="h-4 w-4 transform rotate-180" />
            </div>
          </div>
        </div>
        <p className="text-xs text-center text-gray-400 mt-6">
          Settings are saved automatically on your device.
        </p>
      </div>
    </div>
  );
}

