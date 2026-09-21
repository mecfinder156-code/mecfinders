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

  const { data: addresses } = useSWR(open ? '/mobile/addresses' : null, fetchAddresses);
  const { data: vehicles } = useSWR(open ? '/mobile/vehicles' : null, fetchVehicles);

  // Reset + preselect defaults each time the sheet opens for a service.
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setBookingType(initialType);
    setDate('');
    setTime('');
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
  const canConfirm = !!addressId && !!vehicleId && scheduleReady;

  const price = service?.pricing?.totalPrice || 0;

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
        addressId: addressId as string,
      };
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
                {addresses && addresses.length > 0 ? (
                  <div className="space-y-2">
                    {addresses.map((a: any) => (
                      <button
                        key={a._id}
                        onClick={() => setAddressId(a._id)}
                        className={`w-full text-left p-3 rounded-2xl border transition-colors flex gap-3 items-start ${addressId === a._id ? 'border-[#131F33] bg-[#131F33]/[0.03]' : 'border-gray-200 bg-white'}`}
                      >
                        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${addressId === a._id ? 'border-[#131F33]' : 'border-gray-300'}`}>
                          {addressId === a._id && <span className="w-2 h-2 rounded-full bg-[#131F33]" />}
                        </span>
                        <span className="min-w-0">
                          <span className="text-[13px] font-bold text-[#131F33] block">{a.label || 'Address'}</span>
                          <span className="text-[12px] text-gray-500 font-medium block truncate">{[a.addressLine1, a.city, a.state, a.postalCode].filter(Boolean).join(', ')}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-gray-500 font-medium bg-gray-50 border border-gray-100 rounded-2xl p-3">No saved addresses. Add one from your profile to continue.</p>
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
                  </div>
                ) : (
                  <p className="text-[12px] text-gray-500 font-medium bg-gray-50 border border-gray-100 rounded-2xl p-3">No vehicles saved. Add one from your profile to continue.</p>
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
