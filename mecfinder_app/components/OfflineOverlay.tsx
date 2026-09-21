"use client";

import { useNetwork } from '@/lib/useNetwork';

/**
 * Full-screen "No internet" overlay, shown natively (not a browser error page)
 * whenever connectivity drops. It auto-dismisses the moment the connection is
 * back — the underlying screens keep their state, so the user lands exactly
 * where they were. Mounted once at the app root.
 */
export default function OfflineOverlay() {
  const online = useNetwork();
  if (online) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#FDFDFD] flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-[#FFF0F2] flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-[#6D1B2C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
        </svg>
      </div>
      <h2 className="text-[20px] font-black text-[#131F33] mb-2">No internet connection</h2>
      <p className="text-[14px] text-gray-500 font-medium max-w-xs">
        Check your Wi-Fi or mobile data. We&apos;ll reconnect automatically the moment you&apos;re back online.
      </p>
      <div className="mt-6 flex items-center gap-2 text-[13px] font-bold text-[#6D1B2C]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#6D1B2C]/50 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#6D1B2C]" />
        </span>
        Waiting for connection…
      </div>
    </div>
  );
}
