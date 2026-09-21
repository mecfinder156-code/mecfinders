"use client";

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { addressesApi } from '@/lib/api';

interface Address {
  _id: string;
  label?: 'HOME' | 'WORK' | 'OTHER';
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  isDefault?: boolean;
}

export default function MyAddressesPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/mobile/addresses', () => addressesApi.getAll());
  const addresses: Address[] = data?.data?.addresses || [];

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDelete = async (id: string) => {
    if (busy) return;
    if (!confirm('Remove this address?')) return;
    setBusy(true);
    try {
      await addressesApi.delete(id);
      setMenuFor(null);
      mutate();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not remove address');
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await addressesApi.setDefault(id);
      setMenuFor(null);
      mutate();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not update address');
    } finally {
      setBusy(false);
    }
  };

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

        <div className="flex justify-between items-start mb-8">
          <div className="flex-1 pr-2">
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">My Addresses</h1>
            <p className="text-[13px] text-gray-500 font-medium">Manage your saved addresses for quicker bookings</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D1B2C]" />
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-gray-50 shadow-sm">
            <div className="text-4xl mb-3">📍</div>
            <p className="text-gray-500 font-medium text-sm">No addresses saved yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((a) => (
              <div key={a._id} className="bg-white rounded-[24px] shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col">
                <div className="p-4 flex gap-4 items-start">
                  <div className="w-[84px] h-[84px] bg-[#FFF0F2] rounded-2xl flex items-center justify-center shrink-0">
                    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3L4 9v12h5v-6h6v6h5V9l-8-6z" fill="#E65100"/>
                    </svg>
                  </div>

                  <div className="flex-1 pt-1 relative">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-[16px] font-black text-[#131F33]">{a.label || 'HOME'}</h3>
                      <div className="flex items-center gap-2">
                        {a.isDefault && (
                          <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-100">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            Default
                          </span>
                        )}
                        <button onClick={() => setMenuFor(menuFor === a._id ? null : a._id)} className="text-gray-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-[13px] font-bold text-[#131F33] mb-0.5">
                      {[a.addressLine1, a.addressLine2].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-[12px] font-medium text-gray-500 mb-0.5">
                      {[a.city, a.state, a.postalCode].filter(Boolean).join(', ')}
                    </p>
                    {a.landmark && <p className="text-[11px] font-medium text-gray-400">Landmark: {a.landmark}</p>}

                    {menuFor === a._id && (
                      <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40">
                        {!a.isDefault && (
                          <button onClick={() => handleSetDefault(a._id)} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">Set as default</button>
                        )}
                        <button onClick={() => handleDelete(a._id)} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50">Remove</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[1px] w-full bg-gray-100"></div>
                <div className="p-3 px-4 flex justify-end items-center bg-gray-50/50 rounded-b-[24px]">
                  <Link href={`/profile/addresses/edit?id=${a._id}`} className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#131F33]">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-6 left-6 right-6 z-20">
        <Link href="/profile/addresses/add" className="w-full bg-[#6D1B2C] text-white rounded-[16px] h-14 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgb(109,27,44,0.2)]">
          <svg className="w-5 h-5 bg-white text-[#6D1B2C] rounded-full p-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Add New Address
        </Link>
      </div>
    </div>
  );
}
