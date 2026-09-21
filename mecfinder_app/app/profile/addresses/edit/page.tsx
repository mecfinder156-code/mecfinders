"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import useSWR from 'swr';
import { addressesApi } from '@/lib/api';

interface Address {
  _id: string;
  label?: 'HOME' | 'WORK' | 'OTHER';
  addressLine1: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
}

function EditAddressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const { data, isLoading } = useSWR('/mobile/addresses', () => addressesApi.getAll());
  const address: Address | undefined = (data?.data?.addresses || []).find(
    (a: Address) => a._id === id
  );

  const [type, setType] = useState<'HOME' | 'WORK' | 'OTHER'>('HOME');
  const [addressLine1, setAddressLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Prefill once the address record is available.
  useEffect(() => {
    if (address && !hydrated) {
      setType(address.label || 'HOME');
      setAddressLine1(address.addressLine1 || '');
      setLandmark(address.landmark || '');
      setCity(address.city || '');
      setState(address.state || '');
      setPostalCode(address.postalCode || '');
      setHydrated(true);
    }
  }, [address, hydrated]);

  const canSave = addressLine1.trim() && city.trim() && state.trim() && postalCode.trim();

  const handleSave = async () => {
    if (!canSave || saving || !id) return;
    setSaving(true);
    setError('');
    try {
      await addressesApi.update(id, {
        label: type,
        addressLine1: addressLine1.trim(),
        landmark: landmark.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
      });
      router.push('/profile/addresses');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not update address. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !id) return;
    if (!confirm('Remove this address?')) return;
    setDeleting(true);
    setError('');
    try {
      await addressesApi.delete(id);
      router.push('/profile/addresses');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not remove address.');
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-[#FDFDFD]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D1B2C]" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#FDFDFD] px-6 text-center">
        <p className="text-gray-500 font-medium mb-4">Address not found.</p>
        <button onClick={() => router.push('/profile/addresses')} className="text-[#6D1B2C] font-bold">Back to My Addresses</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden pb-24">
      <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none">
        <img src="/img/new/map_upper.png" alt="City Background" className="w-full h-auto object-cover opacity-80 mix-blend-multiply" />
      </div>

      <div className="flex-1 flex flex-col relative z-10 px-6 pt-14 pb-10">
        <div className="relative mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33] hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-2">
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">Edit Address</h1>
            <p className="text-[13px] text-gray-500 font-medium">Update your saved address</p>
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 z-10">
          {error && (
            <p className="text-[12px] text-red-600 font-semibold mb-4 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="mb-5">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-3 px-1">
              <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Address Type
            </label>
            <div className="flex gap-2">
              <button onClick={() => setType('HOME')} className={`flex-1 py-3 rounded-[12px] flex items-center justify-center gap-2 text-[12px] font-bold transition-colors ${type === 'HOME' ? 'bg-[#FFF0F2] text-[#6D1B2C] border border-[#6D1B2C]' : 'bg-gray-50 text-gray-500 border border-transparent'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                HOME
              </button>
              <button onClick={() => setType('WORK')} className={`flex-1 py-3 rounded-[12px] flex items-center justify-center gap-2 text-[12px] font-bold transition-colors ${type === 'WORK' ? 'bg-[#FFF0F2] text-[#6D1B2C] border border-[#6D1B2C]' : 'bg-gray-50 text-gray-500 border border-transparent'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>
                WORK
              </button>
              <button onClick={() => setType('OTHER')} className={`flex-1 py-3 rounded-[12px] flex items-center justify-center gap-2 text-[12px] font-bold transition-colors ${type === 'OTHER' ? 'bg-[#FFF0F2] text-[#6D1B2C] border border-[#6D1B2C]' : 'bg-gray-50 text-gray-500 border border-transparent'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                OTHER
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-2 px-1">
              <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Flat / House / Building
            </label>
            <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} type="text" placeholder="e.g. 102, Shanti Apts" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-2 px-1">
              <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              Landmark (Optional)
            </label>
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} type="text" placeholder="e.g. Near Metro Station" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-2 px-1">
                <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                City
              </label>
              <input value={city} onChange={(e) => setCity(e.target.value)} type="text" placeholder="e.g. New Delhi" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-2 px-1">
                <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                State
              </label>
              <input value={state} onChange={(e) => setState(e.target.value)} type="text" placeholder="e.g. Delhi" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2 text-[12px] font-bold text-[#131F33] mb-2 px-1">
              <svg className="w-4 h-4 text-[#131F33]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Postal Code
            </label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} type="text" inputMode="numeric" placeholder="e.g. 110001" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
          </div>

          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="w-full bg-[#6D1B2C] text-white rounded-[16px] h-14 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgb(109,27,44,0.2)] disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save Changes'}
            {!saving && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full mt-3 text-[#6D1B2C] font-bold text-[13px] py-3 disabled:opacity-40"
          >
            {deleting ? 'Removing...' : 'Delete Address'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditAddressScreen() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <EditAddressContent />
    </Suspense>
  );
}
