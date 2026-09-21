"use client";

import { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('past');

  const mockPastBookings = [
    { id: 1, title: 'Car Wash', details: 'Honda Motar • Instant', date: '20 Sept 2026, 11:38 pm', price: 148, status: 'Expired', img: '/img/our_services/banner.png' },
    { id: 2, title: 'Car Wash', details: 'Honda Motar • Instant', date: '20 Sept 2026, 10:56 pm', price: 148, status: 'Expired', img: '/img/our_services/banner.png' },
    { id: 3, title: 'Car Wash', details: 'Honda Motar • Scheduled', date: '20 Sept 2026, 08:47 pm', price: 148, status: 'Completed', img: '/img/our_services/banner.png' },
    { id: 4, title: 'Car Wash', details: 'Honda Motar • Instant', date: '20 Sept 2026, 08:44 pm', price: 442, status: 'Completed', img: '/img/our_services/banner.png' },
    { id: 5, title: 'Car Wash', details: 'Honda Motar • Instant', date: '20 Sept 2026, 08:22 pm', price: 148, status: 'Expired', img: '/img/our_services/banner.png' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] pb-24 font-sans relative overflow-hidden">
      
      {/* Header Section */}
      <div className="flex justify-between items-start pt-12 pb-6 px-5 relative z-10">
        <div className="flex-1 mt-2">
          <h1 className="text-[28px] font-black text-[#131F33] leading-tight tracking-tight">My Bookings</h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1 leading-snug max-w-[180px]">Track your current and past services</p>
        </div>
        <div className="absolute right-[-20px] top-4 w-[200px] h-32 pointer-events-none z-20">
          <img src="/img/booking_history/hero.png" alt="Mechanic" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-5 mb-6 z-10 relative">
        <div className="bg-white p-1 rounded-2xl flex relative border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#131F33] rounded-xl transition-all duration-300 ease-out shadow-sm"
            style={{ left: activeTab === 'active' ? '4px' : 'calc(50%)' }}
          />
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3.5 text-[13px] font-bold z-10 transition-colors ${activeTab === 'active' ? 'text-white' : 'text-gray-500'}`}
          >
            Active (0)
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-3.5 text-[13px] font-bold z-10 transition-colors ${activeTab === 'past' ? 'text-white' : 'text-gray-500'}`}
          >
            Past (5)
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-5 flex-1 z-10 relative">
        {activeTab === 'active' ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
             <div className="text-5xl mb-4 opacity-50">🛠️</div>
             <h3 className="text-lg font-black text-[#131F33]">No active bookings</h3>
             <p className="text-sm text-gray-500 font-medium mt-1">You don't have any ongoing services.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mockPastBookings.map((booking) => (
              <div key={booking.id} className="bg-white rounded-[24px] p-3 shadow-[0_4px_15px_rgb(0,0,0,0.03)] border border-gray-50 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
                {/* Image */}
                <div className="w-16 h-16 rounded-[14px] bg-[#FDF8F4] p-1 flex items-center justify-center shrink-0 border border-orange-50/50 overflow-hidden relative">
                  {/* Just using the category emoji or a placeholder image */}
                  {booking.id % 2 === 0 ? (
                    <span className="text-3xl relative z-10">🛵</span>
                  ) : (
                    <span className="text-3xl relative z-10">🚗</span>
                  )}
                  {/* Soft background shape */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent opacity-50"></div>
                </div>
                
                {/* Middle content */}
                <div className="flex-1 py-1">
                  <h3 className="text-[15px] font-black text-[#131F33] mb-0.5 tracking-tight">{booking.title}</h3>
                  <p className="text-[11px] font-medium text-gray-400 mb-1">{booking.details}</p>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                    <span className="text-sm">📅</span> {booking.date}
                  </div>
                </div>
                
                {/* Right content */}
                <div className="flex flex-col items-end justify-between h-full py-1 gap-3 shrink-0">
                  {booking.status === 'Expired' ? (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 text-red-500 text-[10px] font-bold bg-red-50/50">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Expired
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-green-200 text-green-600 text-[10px] font-bold bg-green-50/50">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Completed
                    </span>
                  )}
                  <div className="flex items-center gap-0.5">
                    <span className="text-lg font-black text-[#131F33]">₹{booking.price}</span>
                    <svg className="w-4 h-4 text-gray-400 translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Banner */}
        <div className="mt-8 mb-4 bg-gradient-to-r from-[#FFF5F7] to-[#FCF4EE] rounded-[24px] p-4 px-5 flex items-center justify-between border border-[#FBE5D8] shadow-sm">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 text-3xl leading-none flex items-center justify-center">📅</div>
             <div>
               <h4 className="text-[14px] font-black text-[#131F33] mb-0.5">Book a new service</h4>
               <p className="text-[10px] font-bold text-gray-500">Keep your vehicle in top condition</p>
             </div>
          </div>
          <Link href="/bookings" className="bg-[#FBE29F] hover:bg-[#f2d588] text-[#5A4510] font-black text-[11px] px-4 py-2.5 rounded-full flex items-center gap-1 transition-colors shadow-sm active:scale-95">
            Book New 
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </Link>
        </div>
      </div>

      <BottomNav activeTab="orders" />
    </div>
  );
}
