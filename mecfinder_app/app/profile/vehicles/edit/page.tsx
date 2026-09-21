"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import useSWR from 'swr';
import { vehiclesApi, categoriesApi } from '@/lib/api';

interface Vehicle {
  _id: string;
  make?: string;
  model?: string;
  year?: number;
  fuelType?: string;
  registrationNumber: string;
  nickname?: string;
  vehicleCategoryId?: { _id?: string } | string;
}

function EditVehicleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const { data: vehiclesRes, isLoading } = useSWR('/mobile/vehicles', () => vehiclesApi.getAll());
  const { data: categories = [] } = useSWR('/mobile/categories', () =>
    categoriesApi.getAll().then((res) => res.data || [])
  );

  const vehicle: Vehicle | undefined = (vehiclesRes?.data?.vehicles || []).find(
    (v: Vehicle) => v._id === id
  );

  const [vehicleCategoryId, setVehicleCategoryId] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [fuelType, setFuelType] = useState('Petrol');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  // Prefill once the vehicle record is available.
  useEffect(() => {
    if (vehicle && !hydrated) {
      const catId =
        typeof vehicle.vehicleCategoryId === 'object'
          ? vehicle.vehicleCategoryId?._id
          : vehicle.vehicleCategoryId;
      setVehicleCategoryId(catId || '');
      setMake(vehicle.make || '');
      setModel(vehicle.model || '');
      setYear(vehicle.year ? String(vehicle.year) : '');
      setFuelType(vehicle.fuelType || 'Petrol');
      setRegistrationNumber(vehicle.registrationNumber || '');
      setNickname(vehicle.nickname || '');
      setHydrated(true);
    }
  }, [vehicle, hydrated]);

  const canSave = vehicleCategoryId && registrationNumber.trim();

  const handleSave = async () => {
    if (!canSave || saving || !id) return;
    setSaving(true);
    setError('');
    try {
      await vehiclesApi.update(id, {
        vehicleCategoryId,
        registrationNumber: registrationNumber.trim(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        year: year ? Number(year) : undefined,
        fuelType,
        nickname: nickname.trim() || undefined,
      });
      router.push('/profile/vehicles');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not update vehicle. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !id) return;
    if (!confirm('Remove this vehicle?')) return;
    setDeleting(true);
    setError('');
    try {
      await vehiclesApi.delete(id);
      router.push('/profile/vehicles');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not remove vehicle.');
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

  if (!vehicle) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#FDFDFD] px-6 text-center">
        <p className="text-gray-500 font-medium mb-4">Vehicle not found.</p>
        <button onClick={() => router.push('/profile/vehicles')} className="text-[#6D1B2C] font-bold">Back to My Vehicles</button>
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
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">Edit Vehicle</h1>
            <p className="text-[13px] text-gray-500 font-medium">Update your vehicle details</p>
          </div>
        </div>

        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 z-10">
          {error && (
            <p className="text-[12px] text-red-600 font-semibold mb-4 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="mb-4">
            <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Vehicle Category</label>
            <div className="relative">
              <select
                value={vehicleCategoryId}
                onChange={(e) => setVehicleCategoryId(e.target.value)}
                className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] pl-4 pr-10 font-bold text-[14px] text-[#131F33] appearance-none focus:outline-none focus:border-[#6D1B2C]"
              >
                <option value="">Select Category</option>
                {(Array.isArray(categories) ? categories : []).map((c: any) => (
                  <option key={c._id} value={c._id}>
                    {c.emoji ? `${c.emoji} ` : ''}{c.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Make</label>
              <input value={make} onChange={(e) => setMake(e.target.value)} type="text" placeholder="e.g. Honda" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Model</label>
              <input value={model} onChange={(e) => setModel(e.target.value)} type="text" placeholder="e.g. Civic" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Year</label>
              <div className="relative">
                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] pl-4 pr-10 font-bold text-[14px] text-[#131F33] appearance-none focus:outline-none focus:border-[#6D1B2C]">
                  <option value="">Year</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Fuel Type</label>
              <div className="relative">
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] pl-4 pr-10 font-bold text-[14px] text-[#131F33] appearance-none focus:outline-none focus:border-[#6D1B2C]">
                  <option>Petrol</option>
                  <option>Diesel</option>
                  <option>CNG</option>
                  <option>Electric</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Registration Number</label>
            <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} type="text" placeholder="e.g. DL 01 AB 1234" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
          </div>

          <div className="mb-6">
            <label className="block text-[12px] font-bold text-[#131F33] mb-2 px-1">Nickname (Optional)</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} type="text" placeholder="e.g. My Daily Driver" className="w-full h-14 bg-transparent border border-gray-100 rounded-[14px] px-4 font-bold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] placeholder:font-medium placeholder:text-gray-400" />
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
            {deleting ? 'Removing...' : 'Delete Vehicle'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditVehicleScreen() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <EditVehicleContent />
    </Suspense>
  );
}
