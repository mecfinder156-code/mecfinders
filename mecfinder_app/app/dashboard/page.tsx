"use client";

import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import BookingSheet from '@/components/BookingSheet';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';
import useSWR from 'swr';
import { categoriesApi, servicesApi, bookingsApi } from '@/lib/api';

const ONGOING_LABEL: Record<string, string> = {
  CREATED: 'Finding a mechanic',
  SEARCHING_MECHANIC: 'Finding a mechanic',
  MECHANIC_ASSIGNED: 'Mechanic on the way',
  MECHANIC_ARRIVED: 'Mechanic has arrived',
  WORK_STARTED: 'Service in progress',
  READY_FOR_BILLING: 'Payment pending',
  PAYMENT_PENDING: 'Payment pending',
  PAID: 'Finishing up',
};
const TERMINAL = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export default function DashboardScreen() {
  const { profile } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();

  const [locationName, setLocationName] = useState('Locating...');
  const [cityId, setCityId] = useState<string | null>(null);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [bookingService, setBookingService] = useState<any>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const pref = await Preferences.get({ key: 'SELECTED_LOCATION' });
        if (pref.value) {
          const parsed = JSON.parse(pref.value);
          setLocationName(parsed.name);
          setCityId(parsed.cityId || null);
          return;
        }
        setLocationName('Select a location');
      } catch (err) {
        console.error('Location error:', err);
      }
    };
    fetchLocation();
  }, []);

  // Fetch Categories. NOTE: this SWR key ('/mobile/categories') is shared with
  // the Book and Services pages, so the fetcher MUST return the same shape
  // (the array) everywhere — otherwise the shared cache hands one page an
  // object and `categories.map(...)` throws.
  const { data: categories = [] } = useSWR(
    '/mobile/categories',
    () => categoriesApi.getAll().then((res) => res.data || [])
  );

  // Set first category as active initially
  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0]._id);
    }
  }, [categories, activeCategoryId]);

  // Fetch Original Services based on city and active category
  const servicesKey = activeCategoryId ? `/mobile/services?categoryId=${activeCategoryId}&cityId=${cityId || ''}` : null;
  const { data: servicesResponse } = useSWR(servicesKey, () =>
    servicesApi.getPublicServices({ vehicleCategoryId: activeCategoryId || undefined, cityId: cityId || undefined }).then(r => r.data)
  );
  const originalServices = servicesResponse?.data?.services || [];

  // Ongoing booking so the customer can always resume it (no more "lost on back").
  const { data: bookingsResp } = useSWR(
    '/mobile/bookings?ongoing',
    () => bookingsApi.getAll({ limit: 20 }),
    { refreshInterval: 20000, revalidateOnFocus: true }
  );
  const ongoing = (bookingsResp?.data || []).find((b: any) => !TERMINAL.includes(b.status));
  const ongoingTitle = ongoing
    ? (ongoing.services?.find((s: any) => s.kind === 'ORIGINAL') || ongoing.services?.[0])?.name || 'Service'
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Top Section with gradient */}
      <div className="bg-gradient-to-b from-[#F9F5F0] to-white px-4 pt-12 pb-5 rounded-b-3xl">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/logo.png" alt="Mecfinders" className="h-11 w-11 rounded-xl object-contain" />
            <div>
              <h1 className="text-[20px] font-black text-[#6D1B2C] tracking-tight leading-none">Mecfinders.in</h1>
              <p className="text-gray-500 text-[12px] font-medium mt-0.5">Your Ride, Our Responsibility</p>
            </div>
          </div>
          <div className="flex gap-3 items-center shrink-0">
            <button
              onClick={() => router.push('/notifications')}
              className="relative w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm active:scale-95 transition-transform"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5 text-[#6D1B2C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#6D1B2C] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button onClick={() => router.push('/profile')} className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white overflow-hidden shadow-sm">
               {profile?.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                  <svg className="w-5 h-5 text-gray-100" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
               )}
            </button>
          </div>
        </div>

        {/* Location Selector (rose pill) */}
        <Link href="/select-location" className="inline-flex items-center gap-2 mb-5 bg-[#FBE7EB] px-4 py-2.5 rounded-full w-fit max-w-full">
          <svg className="w-4 h-4 text-[#C1272D] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
          <span className="text-gray-900 font-bold text-sm truncate">{locationName}</span>
          <svg className="w-4 h-4 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </Link>

        {/* Search Bar */}
        <div className="bg-white rounded-2xl shadow-[0_2px_15px_rgb(0,0,0,0.06)] border border-gray-100 flex items-center h-14 px-4 cursor-pointer" onClick={() => router.push('/search')}>
          <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="flex-1 px-3 text-[14px] font-medium text-gray-400 truncate">Search services (e.g. car wash, brake)...</span>
          <span className="w-9 h-9 flex items-center justify-center shrink-0 border-l border-gray-100 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          </span>
        </div>
      </div>

      {/* Ongoing service — always resumable */}
      {ongoing && (
        <div className="px-4 mt-4">
          <button
            onClick={() => router.push(`/booking?id=${ongoing._id}`)}
            className="w-full text-left rounded-2xl bg-[#6D1B2C] text-white px-4 py-3.5 flex items-center gap-3 shadow-[0_6px_20px_rgb(109,27,44,0.25)] active:scale-[0.99] transition-transform"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 shrink-0">
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#FBE29F] animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FBE29F]" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-white/70 uppercase tracking-wide">Ongoing service</p>
              <p className="text-[15px] font-black truncate">{ongoingTitle}</p>
              <p className="text-[12px] font-medium text-white/80 truncate">{ONGOING_LABEL[ongoing.status] || 'In progress'}</p>
            </div>
            <span className="shrink-0 bg-[#FBE29F] text-[#5A4510] font-black text-[12px] px-3.5 py-2 rounded-full flex items-center gap-1">
              Resume
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </span>
          </button>
        </div>
      )}

      {/* Banner */}
      <div className="px-4 mt-4">
        <div className="rounded-2xl overflow-hidden w-full shadow-[0_4px_15px_rgb(0,0,0,0.05)]">
          <img src="/img/dashboard/banner.png" alt="Expert care for every ride" className="w-full h-auto object-cover block" />
        </div>
      </div>

      {/* Horizontal Categories */}
      <div className="px-4 py-5 flex overflow-x-auto gap-6 no-scrollbar">
        {(Array.isArray(categories) ? categories : []).map((cat: any) => {
          const active = activeCategoryId === cat._id;
          return (
            <div
              key={cat._id}
              onClick={() => setActiveCategoryId(cat._id)}
              className="flex flex-col items-center gap-2 shrink-0 relative pb-2 cursor-pointer group"
            >
              <div className={`w-14 h-14 flex items-center justify-center text-3xl rounded-full transition-colors ${active ? 'bg-[#FBE7EB]' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                {cat.emoji}
              </div>
              <span className={`text-[12px] font-bold ${active ? 'text-[#6D1B2C]' : 'text-gray-500 group-hover:text-gray-900'}`}>
                {cat.name}
              </span>
              {active && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-[3px] bg-[#6D1B2C] rounded-t-full"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recommended Services */}
      {originalServices.length > 0 && (
        <div className="pb-2">
          <div className="px-4 flex items-center justify-between mb-1">
            <h2 className="text-xl font-black text-gray-900">Recommended Services</h2>
            <button onClick={() => router.push('/search')} className="text-sm font-bold text-blue-600 flex items-center gap-1 shrink-0">
              See All
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <p className="px-4 text-gray-500 text-[13px] font-medium mb-4">Most booked services near you</p>

          <div className="flex overflow-x-auto gap-4 px-4 no-scrollbar pb-2">
            {originalServices.map((service: any) => {
              const total = service.pricing?.totalPrice || 0;
              const original = Math.round(total * 1.3);
              const discount = original > total && original > 0 ? Math.round(((original - total) / original) * 100) : 0;
              return (
                <div
                  key={service._id}
                  onClick={() => router.push('/search')}
                  className="shrink-0 w-64 bg-white border border-gray-100 rounded-2xl p-3 shadow-[0_2px_12px_rgb(0,0,0,0.05)] cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="w-full h-32 rounded-xl bg-gradient-to-br from-[#F5E6DC] to-[#EBD5C5] mb-3 overflow-hidden relative flex items-center justify-center">
                    {service.image ? (
                      <img src={service.image} alt={service.name} className="w-full h-full object-cover absolute inset-0" />
                    ) : (
                      <span className="text-5xl relative z-10">{service.vehicleCategoryId?.emoji || '🔧'}</span>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-[#6D1B2C] text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-sm">{discount}% OFF</span>
                    )}
                    <span className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 text-[15px] mb-0.5 line-clamp-1">{service.name}</h3>
                  <p className="text-[12px] text-gray-500 font-medium line-clamp-1 mb-2">{service.description || 'Professional service for your vehicle.'}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900 text-base">₹{total}</span>
                      {discount > 0 && <span className="text-xs text-gray-400 line-through">₹{original}</span>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setBookingService(service); }}
                      className="bg-[#FBE29F] hover:bg-[#F3D37A] text-[#5A4510] font-black text-[12px] px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm"
                    >
                      Book
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trust badges */}
      <div className="px-4 mt-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_12px_rgb(0,0,0,0.04)] px-3 py-4 grid grid-cols-4 gap-2">
          {[
            { icon: '🛡️', title: 'Verified', sub: 'Mechanics' },
            { icon: '⚙️', title: 'Genuine', sub: 'Parts' },
            { icon: '🏠', title: 'Service', sub: 'at Home' },
            { icon: '🎧', title: '24/7', sub: 'Support' },
          ].map((b) => (
            <div key={b.title} className="flex flex-col items-center text-center gap-1.5">
              <div className="w-11 h-11 rounded-full bg-[#FBE7EB] flex items-center justify-center text-lg">{b.icon}</div>
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-gray-900">{b.title}</p>
                <p className="text-[11px] font-medium text-gray-500">{b.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BookingSheet service={bookingService} onClose={() => setBookingService(null)} />

      <BottomNav activeTab="home" />
    </div>
  );
}
