"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, bookingsApi, type CreateBookingPayload } from '@/lib/api';
import { useBackHandler } from '@/lib/useBackHandler';

interface BookingSheetProps {
  service: any | null; // when non-null, the sheet is open for this service
  onClose: () => void;
  initialType?: 'instant' | 'schedule';
}

const fetchAddresses = () => api.get('/mobile/addresses').then((res) => res.data?.data?.addresses || []);
const fetchVehicles = () => api.get('/mobile/vehicles').then((res) => res.data?.data?.vehicles || []);

export default function BookingSheet({ service, onClose, initialType = 'instant' }: BookingSheetProps) {
  const open = !!service;
  const router = useRouter();

  const [step, setStep] = useState<'form' | 'success'>('form');
  const [bookingType, setBookingType] = useState<'instant' | 'schedule'>(initialType);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [bookingRef, setBookingRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // "Use my current location" option (GPS) as an alternative to a saved address.
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const { data: addresses } = useSWR(open ? '/mobile/addresses' : null, fetchAddresses);
  const { data: vehicles } = useSWR(open ? '/mobile/vehicles' : null, fetchVehicles);

  // Reset + preselect defaults each time the sheet opens for a service.
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setBookingType(initialType);
    setDate('');
    setTime('');
    setUseCurrentLocation(false);
    setLiveLocation(null);
  }, [open, service?._id, initialType]);

  useEffect(() => {
    if (!open || !addresses) return;
    setAddressId((prev) => prev ?? (addresses.find((a: any) => a.isDefault)?._id || addresses[0]?._id || null));
  }, [open, addresses]);

  useEffect(() => {
    if (!open || !vehicles) return;
    setVehicleId((prev) => prev ?? (vehicles.find((v: any) => v.isDefault)?._id || vehicles[0]?._id || null));
  }, [open, vehicles]);

  // Native back closes the sheet instead of navigating away / exiting the app.
  useBackHandler(open, () => handleClose());

  const scheduleReady = bookingType === 'instant' || (!!date && !!time);
  const locationReady = useCurrentLocation ? !!liveLocation : !!addressId;
  const canConfirm = locationReady && !!vehicleId && scheduleReady;

  const price = service?.pricing?.totalPrice || 0;

  // Fetch the device's GPS and use it as the service location.
  const detectLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      setLiveLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setUseCurrentLocation(true);
      setAddressId(null);
    } catch (e: any) {
      setError('Could not get your location. Allow location permission and try again.');
    } finally {
      setLocating(false);
    }
  };

  const selectedAddress = useMemo(
    () => addresses?.find((a: any) => a._id === addressId),
    [addresses, addressId]
  );

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const payload: CreateBookingPayload = {
        serviceId: service._id,
        vehicleId: vehicleId as string,
        bookingType: bookingType === 'instant' ? 'INSTANT' : 'SCHEDULED',
      };
      if (useCurrentLocation && liveLocation) {
        payload.liveLocation = {
          latitude: liveLocation.latitude,
          longitude: liveLocation.longitude,
          addressLine1: 'Current location',
        };
      } else {
        payload.addressId = addressId as string;
      }
      if (bookingType === 'schedule') {
        payload.scheduledAt = new Date(`${date}T${time}`).toISOString();
      }
      const booking = await bookingsApi.create(payload);
      onClose();
      // Land on the live booking screen so the customer tracks it in realtime.
      // Query-param route (not a dynamic segment) because the app is a static
      // export (output: 'export') and cannot pre-render arbitrary booking ids.
      router.push(`/booking?id=${booking._id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not create booking. Please try again.');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Clear so a fresh open starts clean (after the close animation).
    setTimeout(() => {
      setAddressId(null);
      setVehicleId(null);
      setBookingRef('');
    }, 250);
  };

  // Close the sheet and jump to an add-address / add-vehicle screen. The list
  // SWR refetches on focus, so a newly added item appears when they reopen.
  const goTo = (path: string) => {
    onClose();
    router.push(path);
  };

  if (!open) return null;

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-[32px] overflow-hidden flex flex-col max-h-[92vh]"
        style={{ animation: 'sheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
        </div>

        {step === 'form' ? (
          <>
            {/* Header */}
            <div className="px-6 pt-2 pb-4 flex items-center justify-between shrink-0 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Booking</p>
                <h2 className="text-lg font-black text-[#131F33] truncate">{service?.name}</h2>
              </div>
              <button
                onClick={handleClose}
                className="w-9 h-9 shrink-0 bg-gray-100 rounded-full flex items-center justify-center text-gray-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Booking type */}
              <div>
                <p className="text-[13px] font-black text-[#131F33] mb-2">When</p>
                <div className="bg-gray-100 p-1 rounded-2xl flex relative">
                  <div
                    className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
                    style={{ left: bookingType === 'instant' ? '4px' : 'calc(50%)' }}
                  />
                  <button onClick={() => setBookingType('instant')} className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${bookingType === 'instant' ? 'text-[#131F33]' : 'text-gray-500'}`}>⚡ Instant</button>
                  <button onClick={() => setBookingType('schedule')} className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${bookingType === 'schedule' ? 'text-[#131F33]' : 'text-gray-500'}`}>📅 Schedule</button>
                </div>
                {bookingType === 'schedule' && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-gray-400" />
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:border-gray-400" />
                  </div>
                )}
              </div>

              {/* Address */}
              <div>
                <p className="text-[13px] font-black text-[#131F33] mb-2">Service Address</p>

                {/* Use current location (GPS) */}
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locating}
                  className={`w-full mb-2 flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left ${useCurrentLocation ? 'border-[#131F33] bg-[#131F33]/[0.03]' : 'border-gray-200 bg-white'} disabled:opacity-60`}
                >
                  <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${useCurrentLocation ? 'bg-[#131F33] text-white' : 'bg-[#FFF0F2] text-[#6D1B2C]'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 2v3m0 14v3m10-10h-3M5 12H2m15.07-5.07l-2.12 2.12M9.05 14.95l-2.12 2.12m0-10.14l2.12 2.12m5.9 5.9l2.12 2.12" /><circle cx="12" cy="12" r="3.5" strokeWidth={2.5} /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="text-[13px] font-bold text-[#131F33] block">
                      {locating ? 'Getting your location…' : 'Use my current location'}
                    </span>
                    <span className="text-[12px] text-gray-500 font-medium block truncate">
                      {useCurrentLocation && liveLocation
                        ? `GPS · ${liveLocation.latitude.toFixed(4)}, ${liveLocation.longitude.toFixed(4)}`
                        : 'Mechanic comes to where you are right now'}
                    </span>
                  </span>
                </button>

                {addresses && addresses.length > 0 ? (
                  <div className="space-y-2">
                    {addresses.map((a: any) => (
                      <button
                        key={a._id}
                        onClick={() => { setAddressId(a._id); setUseCurrentLocation(false); }}
                        className={`w-full text-left p-3 rounded-2xl border transition-colors flex gap-3 items-start ${addressId === a._id && !useCurrentLocation ? 'border-[#131F33] bg-[#131F33]/[0.03]' : 'border-gray-200 bg-white'}`}
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${addressId === a._id && !useCurrentLocation ? 'border-[#131F33]' : 'border-gray-300'}`}>
                          {addressId === a._id && !useCurrentLocation && <span className="w-2 h-2 rounded-full bg-[#131F33]" />}
                        </span>
                        <span className="min-w-0">
                          <span className="text-[13px] font-bold text-[#131F33] block">{a.label || 'Address'}</span>
                          <span className="text-[12px] text-gray-500 font-medium block truncate">{[a.addressLine1, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</span>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => goTo('/profile/addresses/add')}
                      className="w-full flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#6D1B2C] py-2.5 active:scale-[0.98] transition-transform"
                    >
                      <PlusIcon /> Add another address
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => goTo('/profile/addresses/add')}
                      className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-[#131F33] bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-3.5 active:scale-[0.98] transition-transform"
                    >
                      <PlusIcon /> Add a saved address
                    </button>
                  </div>
                )}
              </div>

              {/* Vehicle */}
              <div>
                <p className="text-[13px] font-black text-[#131F33] mb-2">Vehicle</p>
                {vehicles && vehicles.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {vehicles.map((v: any) => (
                      <button
                        key={v._id}
                        onClick={() => setVehicleId(v._id)}
                        className={`shrink-0 text-left p-3 rounded-2xl border transition-colors min-w-[150px] ${vehicleId === v._id ? 'border-[#131F33] bg-[#131F33]/[0.03]' : 'border-gray-200 bg-white'}`}
                      >
                        <span className="text-[13px] font-bold text-[#131F33] block truncate">{v.nickname || `${v.make} ${v.model}`}</span>
                        <span className="text-[12px] text-gray-500 font-medium block truncate">{[v.make, v.model, v.year].filter(Boolean).join(' · ')}</span>
                        {v.regNumber && <span className="text-[11px] text-gray-400 font-semibold block mt-0.5">{v.regNumber}</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => goTo('/profile/vehicles/add')}
                      className="shrink-0 min-w-[120px] rounded-2xl border border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-[12px] font-bold text-[#6D1B2C] active:scale-[0.98] transition-transform"
                    >
                      <PlusIcon /> Add vehicle
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[12px] text-gray-500 font-medium bg-gray-50 border border-gray-100 rounded-2xl p-3">No vehicles saved yet.</p>
                    <button
                      type="button"
                      onClick={() => goTo('/profile/vehicles/add')}
                      className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-[#131F33] bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-3.5 active:scale-[0.98] transition-transform"
                    >
                      <PlusIcon /> Add a vehicle
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky CTA */}
            <div className="p-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgb(0,0,0,0.05)] shrink-0">
              {error && (
                <p className="text-[12px] text-red-600 font-semibold mb-2 text-center">{error}</p>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">Total</span>
                  <span className="text-2xl font-black text-[#131F33]">₹{price}</span>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || submitting}
                  className="flex-1 bg-[#131F33] text-white py-3.5 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
                >
                  {submitting
                    ? 'Booking…'
                    : bookingType === 'instant'
                    ? 'Confirm Booking'
                    : 'Schedule Booking'}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Success */
          <div className="px-6 pt-4 pb-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-5 mt-4">
              <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
            <h2 className="text-2xl font-black text-[#131F33] mb-1">Booking Confirmed</h2>
            <p className="text-gray-500 text-sm font-medium mb-5 max-w-[280px]">
              {bookingType === 'instant'
                ? 'A mechanic will be assigned and reach you in 30–45 mins.'
                : `Scheduled for ${date} at ${time}. You'll get a reminder.`}
            </p>

            <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2.5 text-left mb-6">
              <Row label="Reference" value={bookingRef} />
              <Row label="Service" value={service?.name} />
              {selectedAddress && <Row label="Address" value={selectedAddress.label || selectedAddress.city} />}
              <Row label="Amount" value={`₹${price}`} />
            </div>

            <button onClick={handleClose} className="w-full bg-[#131F33] text-white py-3.5 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-transform">
              Done
            </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}} />
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-[12px] text-gray-500 font-semibold">{label}</span>
      <span className="text-[13px] text-[#131F33] font-bold text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
    </svg>
  );
}
