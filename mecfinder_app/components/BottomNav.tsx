"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface BottomNavProps {
  activeTab: 'home' | 'bookings' | 'search' | 'orders' | 'profile';
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 pb-safe flex justify-around items-center shadow-[0_-4px_15px_-10px_rgba(0,0,0,0.1)] z-50">
      
      <Link href="/dashboard" className="flex flex-col items-center p-1 w-16">
        <div className={`w-10 h-8 flex items-center justify-center rounded-xl mb-1 ${activeTab === 'home' ? 'bg-[#FFE9A6] text-gray-900' : 'text-gray-500'}`}>
           <svg className="w-5 h-5" fill={activeTab === 'home' ? 'currentColor' : 'none'} stroke={activeTab === 'home' ? 'none' : 'currentColor'} viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={activeTab === 'home' ? "M11.25 2.25l-9 7.5a.75.75 0 00.96 1.15l1.04-.86v9.71c0 .41.34.75.75.75h4.5a.75.75 0 00.75-.75v-4.5h3.75v4.5c0 .41.34.75.75.75h4.5c.41 0 .75-.34.75-.75v-9.71l1.04.86a.75.75 0 00.96-1.15l-9-7.5a.75.75 0 00-.96 0z" : "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"} />
           </svg>
        </div>
        <span className={`text-[10px] ${activeTab === 'home' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>Home</span>
      </Link>
      
      <Link href="/bookings" className="flex flex-col items-center p-1 w-16">
        <div className={`w-10 h-8 flex items-center justify-center rounded-xl mb-1 ${activeTab === 'bookings' ? 'bg-[#FFE9A6] text-gray-900' : 'text-gray-500'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <span className={`text-[10px] ${activeTab === 'bookings' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>Book</span>
      </Link>

      <Link href="/search" className="flex flex-col items-center p-1 w-16">
        <div className={`w-10 h-8 flex items-center justify-center rounded-xl mb-1 ${activeTab === 'search' ? 'bg-[#FFE9A6] text-gray-900' : 'text-gray-500'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        </div>
        <span className={`text-[10px] ${activeTab === 'search' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>Services</span>
      </Link>

      <Link href="/my-bookings" className="flex flex-col items-center p-1 w-16">
        <div className={`w-10 h-8 flex items-center justify-center rounded-xl mb-1 ${activeTab === 'orders' ? 'bg-[#FFE9A6] text-gray-900' : 'text-gray-500'}`}>
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
           </svg>
        </div>
        <span className={`text-[10px] ${activeTab === 'orders' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>Bookings</span>
      </Link>

      <Link href="/profile" className="flex flex-col items-center p-1 w-16">
        <div className="w-10 h-8 bg-[#6B21A8] flex items-center justify-center rounded-xl mb-1 text-white">
          <span className="text-[12px] font-black italic tracking-tighter">mF.</span>
        </div>
        <span className={`text-[10px] ${activeTab === 'profile' ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>Profile</span>
      </Link>

    </div>
  );
}
