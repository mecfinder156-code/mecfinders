"use client";

import { useRouter } from 'next/navigation';

export default function SettingsScreen() {
  const router = useRouter();
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-primary px-6 pt-12 pb-4 flex items-center shadow-sm">
        <button onClick={() => router.back()} className="text-white mr-4">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-xl">Settings</h1>
      </div>

      <div className="p-6 flex-1">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center h-64">
          <span className="text-4xl mb-4">⚙️</span>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Settings</h2>
          <p className="text-sm text-gray-500">Manage your application preferences and notifications here.</p>
        </div>
      </div>
    </div>
  );
}
