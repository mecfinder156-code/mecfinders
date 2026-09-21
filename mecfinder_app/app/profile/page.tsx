"use client";

import Link from 'next/link';
import useSWR from 'swr';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { vehiclesApi, addressesApi, bookingsApi } from '@/lib/api';

export default function ProfileScreen() {
  const { profile, logout } = useAuth();
  const router = useRouter();

  // Real stats — counts come straight from the DB via the mobile APIs.
  const { data: vehiclesRes } = useSWR('/mobile/vehicles', () => vehiclesApi.getAll());
  const { data: addressesRes } = useSWR('/mobile/addresses', () => addressesApi.getAll());
  const { data: bookingsRes } = useSWR('/mobile/bookings?limit=1', () =>
    bookingsApi.getAll({ limit: 1 })
  );

  const vehicleCount = vehiclesRes?.data?.vehicles?.length ?? 0;
  const addressCount = addressesRes?.data?.addresses?.length ?? 0;
  const bookingCount = bookingsRes?.pagination?.total ?? 0;

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error(err);
    }
  };

  const menuItems = [
    { label: 'Personal Information', subtext: 'View and update your profile details', href: '/profile/personal-info', icon: '👤', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'My Vehicles', subtext: 'Add, remove and manage your vehicles', href: '/profile/vehicles', icon: '🚗', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'My Addresses', subtext: 'Manage home, work and other addresses', href: '/profile/addresses', icon: '📍', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'Settings', subtext: 'App preferences and notifications', href: '/profile/settings', icon: '⚙️', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'Help & Support', subtext: 'FAQs, contact us, and more', href: '/profile/support', icon: '🎧', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'Terms & Conditions', subtext: 'Read our terms of service', href: '/profile/terms', icon: '📄', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
    { label: 'Privacy Policy', subtext: 'Your data and privacy', href: '/profile/privacy', icon: '🛡️', bg: 'bg-[#F9F5F0]', text: 'text-gray-900' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Premium Off-White Header */}
      <div className="bg-gradient-to-b from-[#F9F5F0] to-white px-6 pt-16 pb-24 rounded-b-[40px] relative border-b border-gray-100">
        <div className="absolute top-12 right-6">
          <button onClick={() => router.push('/profile/personal-info')} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            Edit
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center font-bold text-white text-3xl shadow-md relative overflow-hidden border-2 border-white">
            {profile?.avatar ? (
              <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              profile?.name?.charAt(0).toUpperCase() || 'U'
            )}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full z-10"></div>
          </div>
          <div>
            <h2 className="text-gray-900 font-black text-2xl tracking-tight">{profile?.name || 'User'}</h2>
            <p className="text-gray-500 text-sm font-medium">{profile?.email || profile?.phone || 'No email provided'}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 bg-[#F5E6DC] px-2.5 py-1 rounded-md border border-[#EBD5C5]">
              <span className="text-yellow-600 text-[10px]">✨</span>
              <span className="text-[#6D1B2C] text-[10px] font-black uppercase tracking-wider">Premium Member</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card Overlapping Header */}
      <div className="px-6 -mt-12 mb-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.06)] border border-gray-100 p-4 flex justify-between items-center">
          <div className="flex flex-col items-center flex-1 border-r border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xl">📅</span>
              <span className="font-black text-gray-900 text-xl">{bookingCount}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Bookings</span>
          </div>
          <div className="flex flex-col items-center flex-1 border-r border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xl">🚗</span>
              <span className="font-black text-gray-900 text-xl">{vehicleCount}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Vehicles</span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xl">📍</span>
              <span className="font-black text-gray-900 text-xl">{addressCount}</span>
            </div>
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide text-center">Addresses</span>
          </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-6 flex-1 space-y-3">
        {menuItems.map((item, index) => (
          <Link key={index} href={item.href} className="bg-white p-3.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-4">
              <div className={`w-11 h-11 ${item.bg} rounded-xl flex items-center justify-center text-lg shadow-sm border border-orange-900/5`}>
                {item.icon}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-[15px]">{item.label}</h3>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">{item.subtext}</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}

        <button onClick={handleLogout} className="w-full mt-4 bg-white border border-gray-200 text-[#6D1B2C] rounded-2xl p-4 flex items-center justify-center gap-2 font-black tracking-wide hover:bg-gray-50 transition-colors shadow-sm active:scale-[0.98]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>LOGOUT</span>
        </button>
      </div>

      <BottomNav activeTab="profile" />
    </div>
  );
}
