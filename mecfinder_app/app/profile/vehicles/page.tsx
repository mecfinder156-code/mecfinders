"use client";

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { vehiclesApi } from '@/lib/api';

interface Vehicle {
  _id: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  registrationNumber: string;
  nickname?: string;
  isDefault?: boolean;
  vehicleCategoryId?: { name?: string } | string;
}

export default function MyVehiclesPage() {
  const router = useRouter();
  const { data, isLoading, mutate } = useSWR('/mobile/vehicles', () => vehiclesApi.getAll());
  const vehicles: Vehicle[] = data?.data?.vehicles || [];

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categoryName = (v: Vehicle) =>
    typeof v.vehicleCategoryId === 'object' ? v.vehicleCategoryId?.name : undefined;

  const handleDelete = async (id: string) => {
    if (busy) return;
    if (!confirm('Remove this vehicle?')) return;
    setBusy(true);
    try {
      await vehiclesApi.delete(id);
      setMenuFor(null);
      mutate();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not remove vehicle');
    } finally {
      setBusy(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await vehiclesApi.setDefault(id);
      setMenuFor(null);
      mutate();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not update vehicle');
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
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">My Vehicles</h1>
            <p className="text-[13px] text-gray-500 font-medium">Manage your vehicles for faster bookings</p>
          </div>
          <div className="w-32 h-24 shrink-0 relative flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0 bg-[#FFF0F2] rounded-full opacity-60 scale-90"></div>
            <img src="/img/new/car_upper.png" className="w-full h-full object-contain relative z-10 scale-125 translate-x-2 translate-y-2" />
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D1B2C]" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-[24px] p-8 text-center border border-gray-50 shadow-sm">
            <div className="text-4xl mb-3">🚗</div>
            <p className="text-gray-500 font-medium text-sm">No vehicles yet. Add one to book faster.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {vehicles.map((v) => (
              <div key={v._id} className="bg-white rounded-[24px] shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 flex flex-col">
                <div className="p-4 flex gap-4 items-start">
                  <div className="w-[84px] h-[84px] bg-[#FFF0F2] rounded-2xl flex items-center justify-center p-2 shrink-0">
                    <img src="/img/new/car_upper_1.png" className="w-full h-auto object-contain mix-blend-multiply" />
                  </div>

                  <div className="flex-1 pt-1 relative">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="text-[16px] font-black text-[#131F33]">{v.nickname || `${v.make || 'Vehicle'} ${v.model || ''}`.trim()}</h3>
                      <div className="flex items-center gap-2">
                        {v.isDefault && (
                          <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-100">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                            Default
                          </span>
                        )}
                        <button onClick={() => setMenuFor(menuFor === v._id ? null : v._id)} className="text-gray-400">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-[12px] font-medium text-gray-500 mb-2.5">
                      {[v.make, v.model].filter(Boolean).join(' ')}{v.year ? ` (${v.year})` : ''}
                    </p>
                    <div className="inline-flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">{v.registrationNumber}</span>
                    </div>

                    {menuFor === v._id && (
                      <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-40">
                        {!v.isDefault && (
                          <button onClick={() => handleSetDefault(v._id)} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50">Set as default</button>
                        )}
                        <button onClick={() => handleDelete(v._id)} className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50">Remove</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[1px] w-full bg-gray-100"></div>
                <div className="p-3 px-4 flex justify-between items-center bg-gray-50/50 rounded-b-[24px]">
                  <div className="flex items-center gap-5">
                    {categoryName(v) && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                        {categoryName(v)}
                      </div>
                    )}
                    {v.fuelType && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        {v.fuelType}
                      </div>
                    )}
                  </div>
                  <Link href={`/profile/vehicles/edit?id=${v._id}`} className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#131F33]">
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
        <Link href="/profile/vehicles/add" className="w-full bg-[#6D1B2C] text-white rounded-[16px] h-14 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgb(109,27,44,0.2)]">
          <svg className="w-5 h-5 bg-white text-[#6D1B2C] rounded-full p-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Add New Vehicle
        </Link>
      </div>
    </div>
  );
}
