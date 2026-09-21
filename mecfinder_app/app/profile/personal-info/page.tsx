"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { profileApi } from '@/lib/api';

export default function PersonalInfoPage() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Prefill from the authenticated profile once it is available.
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await profileApi.update({ name: name.trim(), email: email.trim() });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden">

      {/* Cityscape Bottom Graphic */}
      <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none">
         <img src="/img/new/map_upper.png" alt="City Background" className="w-full h-auto object-cover opacity-80 mix-blend-multiply" />
      </div>

      <div className="flex-1 flex flex-col relative z-10 px-6 pt-14 pb-10">

        {/* Top Header & Back */}
        <div className="relative mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33] hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 pr-2">
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">Personal Information</h1>
            <p className="text-[13px] text-gray-500 font-medium">Manage your account details</p>
          </div>

          <div className="w-24 h-24 shrink-0 relative flex items-center justify-center pointer-events-none">
             {/* Fallback SVG for ID card graphic since it wasn't named clearly in assets */}
             <div className="absolute inset-0 bg-[#FFF0F2] rounded-full opacity-60"></div>
             <svg className="w-16 h-16 text-[#6D1B2C] relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4 5a3 3 0 100-6 3 3 0 000 6zm-3 7a5 5 0 0110 0H5zm11-6h4v-2h-4v2zm0 4h4v-2h-4v2z" /></svg>
             <div className="absolute top-1 right-0 w-8 h-8 bg-[#6D1B2C] rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm z-20">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
             </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 z-10">

          {error && (
            <p className="text-[12px] text-red-600 font-semibold mb-4 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
          {saved && (
            <p className="text-[12px] text-green-600 font-semibold mb-4 bg-green-50 rounded-xl px-3 py-2">Profile updated.</p>
          )}

          {/* Phone (Read Only) */}
          <div className="mb-5">
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5 px-1">Phone Number <span className="text-gray-400">(Read-only)</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5A9E88]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              </div>
              <input type="text" readOnly value={profile?.phone || ''} className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 font-bold text-[15px] text-[#131F33] focus:outline-none" />
            </div>
          </div>

          {/* Full Name */}
          <div className="mb-5">
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5 px-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full h-14 bg-transparent border border-gray-100 rounded-2xl pl-12 pr-4 font-bold text-[15px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] transition-colors" />
            </div>
          </div>

          {/* Email */}
          <div className="mb-8">
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5 px-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-14 bg-transparent border border-gray-100 rounded-2xl pl-12 pr-4 font-bold text-[15px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] transition-colors" />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full bg-[#6D1B2C] text-white rounded-[16px] h-14 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Changes'}
            {!saving && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
          </button>
        </div>

      </div>
    </div>
  );
}
