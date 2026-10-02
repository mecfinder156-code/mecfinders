"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Capacitor } from '@capacitor/core';
import { Checkout } from 'capacitor-razorpay';
import { bookingsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBookingLive } from '@/lib/useBookingLive';
import { useLocationStream } from '@/lib/useLocationStream';
import LiveTrackingMap from '@/components/LiveTrackingMap';

// Statuses during which the customer should see the mechanic moving on a map.
const TRACKING_STATUSES = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED'];

// Load the Razorpay checkout script once, on demand. Without this `window.Razorpay`
// is undefined and opening checkout throws ("Failed to initiate payment").
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function BookingContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const { profile } = useAuth();

  // Socket pushes live status + location in real time; the poll is only a
  // slow safety net, so keep it gentle (was 5s — that plus the socket stream
  // was double-fetching every few seconds).
  const { data: booking, error, mutate } = useSWR(id ? `/mobile/bookings/${id}` : null, () => bookingsApi.getById(id as string), { refreshInterval: 20000 });
  const [busy, setBusy] = useState(false);

  // Draggable live-tracking sheet height (fraction of the viewport). The user
  // can drag it up/down (Rapido-style) to reveal more of the map.
  const [sheetFrac, setSheetFrac] = useState(0.5);
  const sheetDrag = useRef<{ y: number; f: number } | null>(null);
  const onSheetDragStart = (clientY: number) => {
    sheetDrag.current = { y: clientY, f: sheetFrac };
  };
  const onSheetDragMove = (clientY: number) => {
    if (!sheetDrag.current || typeof window === 'undefined') return;
    const dy = clientY - sheetDrag.current.y;
    const next = sheetDrag.current.f - dy / window.innerHeight; // drag up → taller
    setSheetFrac(Math.max(0.25, Math.min(0.85, next)));
  };
  const onSheetDragEnd = () => {
    sheetDrag.current = null;
  };

  // Live mechanic location: seeded from the booking payload, then updated in
  // real time by the socket stream (falls back to SWR's 5s refetch).
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useBookingLive(
    id,
    () => mutate(),
    (loc) => setLiveLocation(loc)
  );

  // Customer streams its own GPS during tracking so the mechanic sees it live.
  const [selfLocation, setSelfLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useLocationStream(id, booking ? TRACKING_STATUSES.includes(booking.status) : false, setSelfLocation);

  if (!id) return <Centered>Invalid URL</Centered>;
  if (error) return <Centered>Failed to load booking</Centered>;
  if (!booking) return <Centered>Loading…</Centered>;
  
  // Live location: prefer the socket stream, fall back to the last-known
  // location baked into the booking payload.
  const mechanicLocation =
    liveLocation ||
    (booking.mechanic?.currentLocation &&
    typeof booking.mechanic.currentLocation.latitude === 'number'
      ? {
          latitude: booking.mechanic.currentLocation.latitude,
          longitude: booking.mechanic.currentLocation.longitude,
        }
      : null);

  // The customer's own marker: prefer their live GPS, else the booking's
  // service address. Shown to the customer and streamed to the mechanic.
  const customerLocation =
    selfLocation ||
    (typeof booking.serviceLocation?.latitude === 'number' &&
    typeof booking.serviceLocation?.longitude === 'number'
      ? {
          latitude: booking.serviceLocation.latitude,
          longitude: booking.serviceLocation.longitude,
        }
      : null);

  // Extract info
  const serviceName = booking.services?.[0]?.name || 'Service';
  const serviceCost = booking.services?.[0]?.priceSnapshot?.totalPrice || booking.bill?.totalAmount || '0';
  const categoryName = booking.services?.[0]?.categoryName || 'CAR WASH';

  // Additional services the mechanic proposed during work; the customer must
  // approve/reject each one (kind ADDITIONAL + status REQUESTED).
  const pendingAdditional = (booking.services || []).filter(
    (s: any) => s.kind === 'ADDITIONAL' && s.status === 'REQUESTED'
  );
  const respondAdditional = (itemId: string, accept: boolean) => {
    setBusy(true);
    bookingsApi
      .respondAdditional(id as string, itemId, accept)
      .then(() => mutate())
      .finally(() => setBusy(false));
  };
  
  let title = "Finding a";
  let highlightTitle = "mechanic";
  let subtitle = "Please wait while we assign the best mechanic.";
  let activeSteps = 1;
  
  if (['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED'].includes(booking.status)) {
     title = "Mechanic";
     highlightTitle = "is on the way";
     subtitle = "Your mechanic is coming to your location.";
     activeSteps = 2;
  } else if (booking.status === 'WORK_STARTED') {
     title = "Service";
     highlightTitle = "in progress";
     subtitle = "Mechanic is working on your vehicle.";
     activeSteps = 3;
  } else if (['READY_FOR_BILLING', 'PAYMENT_PENDING', 'PAID'].includes(booking.status)) {
     title = "Service";
     highlightTitle = "completed";
     subtitle = "Please complete the payment.";
     activeSteps = 4;
  } else if (booking.status === 'COMPLETED') {
     title = "Booking";
     highlightTitle = "completed";
     subtitle = "Thank you for choosing MecFinders.";
     activeSteps = 4;
  } else if (['EXPIRED', 'CANCELLED'].includes(booking.status)) {
     title = "No mechanic";
     highlightTitle = "available";
     subtitle = "Please try booking again.";
     activeSteps = 2;
  }

  const cancelBooking = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setBusy(true);
    try {
      await bookingsApi.cancel(id as string, 'Cancelled by customer');
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const payCash = async () => {
    setBusy(true);
    try {
      await bookingsApi.pay(id as string, 'CASH');
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const payRazorpay = async () => {
    setBusy(true);
    try {
      const orderRes = await bookingsApi.pay(id as string, 'RAZORPAY');
      const { orderId, amount, keyId } = orderRes;
      if (!orderId) throw new Error('Could not create the payment order. Please try again.');

      const options: any = {
        key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: Math.round(Number(amount) * 100), // Razorpay expects paise
        currency: 'INR',
        name: 'MecFinders',
        description: 'Service Payment',
        order_id: orderId,
        prefill: {
          name: profile?.name || undefined,
          email: profile?.email || undefined,
          contact: profile?.phone || undefined,
        },
        theme: { color: '#6D1B2C' },
      };

      const verify = (resp: any) =>
        bookingsApi.verifyRazorpay(id as string, {
          paymentId: resp.razorpay_payment_id,
          orderId: resp.razorpay_order_id,
          signature: resp.razorpay_signature,
        });

      if (Capacitor.isNativePlatform()) {
        // Native Razorpay SDK → full UPI incl. GPay/PhonePe app intent (the web
        // checkout.js hides UPI inside a WebView).
        const result: any = await Checkout.open(options);
        const resp =
          typeof result?.response === 'string' ? JSON.parse(result.response) : result?.response || result;
        await verify(resp);
        mutate();
      } else {
        // Web (dev/browser) fallback: checkout.js.
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Could not load the payment gateway. Check your connection.');
        const rzp = new (window as any).Razorpay({
          ...options,
          handler: async (response: any) => {
            try {
              await verify(response);
            } finally {
              mutate();
            }
          },
        });
        rzp.on('payment.failed', (resp: any) => {
          alert(resp?.error?.description || 'Payment failed. Please try again.');
        });
        rzp.open();
      }
    } catch (err: any) {
      console.error(err);
      // Native SDK rejects with an error JSON on failure; it also rejects when
      // the user dismisses checkout — don't nag on a plain cancel.
      const msg = err?.response?.data?.message || err?.error?.description || err?.message || '';
      if (msg && !/cancel/i.test(String(msg))) {
        alert(msg || 'Failed to initiate payment');
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Live tracking: full-screen native map + bottom sheet (Rapido style) ──
  if (TRACKING_STATUSES.includes(booking.status)) {
    return (
      <div className="fixed inset-0 bg-[#EEF2F6] overflow-hidden">
        {/* Full-bleed map fills the screen; the sheet sits on top of it.
            z-0 makes this an isolated stacking context so Leaflet's internal
            panes/controls (z-index up to 1000) stay contained below the sheet
            instead of painting over the whole screen. */}
        <div className="absolute inset-0 z-0">
          <LiveTrackingMap mechanic={mechanicLocation} customer={customerLocation} statusText={subtitle} />
        </div>

        {/* Floating back button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="absolute top-14 left-5 z-10 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center text-[#131F33] active:scale-95 transition-transform"
          aria-label="Back"
        >
          <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
        </button>

        {/* Bottom sheet — drag the handle up/down to reveal more of the map */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] px-6 pb-10 overflow-y-auto transition-[height] duration-100"
          style={{ height: `${Math.round(sheetFrac * 100)}vh` }}
        >
          {/* Drag handle (sticky so it stays grabbable while content scrolls) */}
          <div
            className="sticky top-0 -mx-6 px-6 pt-3 pb-3 bg-white rounded-t-[28px] cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onTouchStart={(e) => onSheetDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => onSheetDragMove(e.touches[0].clientY)}
            onTouchEnd={onSheetDragEnd}
            onPointerDown={(e) => onSheetDragStart(e.clientY)}
            onPointerMove={(e) => { if (e.buttons === 1) onSheetDragMove(e.clientY); }}
            onPointerUp={onSheetDragEnd}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />
          </div>


          {/* Status line */}
          <div className="flex items-center gap-2 mb-1">
            {mechanicLocation && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
            )}
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{categoryName}</p>
          </div>
          <h1 className="text-[24px] font-black text-[#131F33] tracking-tight leading-tight">
            {title} <span className="text-[#6D1B2C]">{highlightTitle}</span>
          </h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1 mb-4">
            {booking.status === 'MECHANIC_ARRIVED'
              ? 'Mechanic has arrived at your location'
              : booking.status === 'WORK_STARTED'
              ? 'Mechanic is on-site and working'
              : mechanicLocation
              ? 'Live · Mechanic is on the way'
              : subtitle}
          </p>

          {/* Status Bar */}
          <div className="flex items-center gap-1.5 mb-5 w-48">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < activeSteps ? 'bg-[#6D1B2C]' : 'bg-gray-200'}`} />
            ))}
          </div>

          {/* Additional-service approval (mechanic proposed extra work) */}
          <PendingApproval items={pendingAdditional} busy={busy} onRespond={respondAdditional} />

          {/* Mechanic profile */}
          {booking.mechanic && (
            <div className="bg-[#FBFBFC] rounded-[20px] p-4 border border-gray-50 mb-4 flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <div className="w-12 h-12 bg-[#FFF0F2] rounded-full flex items-center justify-center text-[#6D1B2C] text-[20px] font-black">
                  {booking.mechanic.name?.[0] || 'M'}
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-[#131F33]">{booking.mechanic.name || 'Mechanic'}</h3>
                  <p className="text-[12px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                    <span className="text-[#F5A623]">★</span> {booking.mechanic.ratingAverage?.toFixed(1) || '4.8'} · {booking.mechanic.ratingCount || 0} reviews
                  </p>
                </div>
              </div>
              <a href={`tel:${booking.mechanic.phone}`} className="w-12 h-12 bg-[#10B981] rounded-full flex items-center justify-center text-white shadow-sm active:scale-95 transition-transform">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
              </a>
            </div>
          )}

          {/* Service OTP — needed so the mechanic can start work */}
          {booking.otp && booking.status !== 'WORK_STARTED' && (
            <div className="bg-[#FBFBFC] rounded-[20px] p-4 border border-gray-50 mb-4">
              <h3 className="text-[14px] font-black text-[#131F33]">Service OTP</h3>
              <p className="text-[12px] text-gray-500 font-medium mb-3">Share this with the mechanic to start the service.</p>
              <div className="flex justify-between gap-3">
                {booking.otp.split('').map((digit: string, i: number) => (
                  <div key={i} className="flex-1 aspect-[4/5] bg-[#FFF0F2] rounded-[14px] flex items-center justify-center">
                    <span className="text-[28px] font-black text-[#6D1B2C]">{digit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel (only before work starts) */}
          {['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED'].includes(booking.status) && (
            <button onClick={cancelBooking} disabled={busy} className="w-full h-13 py-3.5 rounded-[16px] border border-[#E11D48] text-[#E11D48] font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform bg-white disabled:opacity-50">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel booking
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden pb-24">

      {/* Map Background for active states */}
      {booking.status !== 'EXPIRED' && booking.status !== 'CANCELLED' && (
        <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none">
          <img src="/img/new/map_upper.png" alt="City Background" className="w-full h-auto object-cover opacity-80 mix-blend-multiply" />
        </div>
      )}

      <div className="flex-1 flex flex-col relative z-10 px-6 pt-14 pb-10">
        
        {/* Header section */}
        <div className="relative mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33] hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
        
        <div className="flex justify-between items-start mb-6">
           <div className="flex-1">
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">{categoryName}</p> 
             <h1 className="text-[26px] font-black text-[#131F33] tracking-tight leading-tight">
                {title} <span className="text-[#6D1B2C]">{highlightTitle}</span>
             </h1>
             <p className="text-[13px] text-gray-500 font-medium mt-1">{subtitle}</p>
             
             {/* Status Bar */}
             <div className="flex items-center gap-1.5 mt-4 w-48">
               {Array.from({length: 4}).map((_, i) => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i < activeSteps ? 'bg-[#6D1B2C]' : 'bg-gray-200'}`} />
               ))}
             </div>
           </div>
           
           <div className="w-28 h-28 shrink-0 relative flex items-center justify-center pointer-events-none -mt-4">
               <div className="absolute inset-0 bg-[#FFF0F2] rounded-full opacity-60 scale-90"></div>
               {/* Illustration based on status */}
               {['EXPIRED', 'CANCELLED'].includes(booking.status) ? (
                 <div className="relative w-full h-full flex items-center justify-center">
                   <img src="/img/new/car_upper_1.png" className="w-[110%] object-contain mix-blend-multiply" />
                   <div className="absolute top-2 right-2 bg-white rounded-full border-2 border-[#E11D48] shadow-sm z-20">
                     <svg className="w-8 h-8 text-[#E11D48]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                   </div>
                 </div>
               ) : (
                 <div className="relative w-full h-full flex items-center justify-center">
                   <img src="/img/new/bike_upper.png" className="w-[120%] object-contain mix-blend-multiply" />
                   <div className="absolute -top-1 -right-1 z-20 text-[#6D1B2C]">
                     <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                   </div>
                 </div>
               )}
           </div>
        </div>

        {/* Failed / Expired Layout */}
        {['EXPIRED', 'CANCELLED'].includes(booking.status) && (
          <>
            <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4 flex justify-between items-center">
               <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-[#FFF0F2] rounded-xl flex items-center justify-center text-[#6D1B2C]">
                     <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>
                  </div>
                  <div>
                     <h3 className="text-[14px] font-black text-[#131F33]">{serviceName}</h3>
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">BOOKED · CANCELLED</p>
                  </div>
               </div>
               <div className="w-[1px] h-10 bg-gray-100 mx-2"></div>
               <div className="text-right">
                  <h3 className="text-[16px] font-black text-[#131F33]">₹{serviceCost}</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Service Cost</p>
               </div>
            </div>

            <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4 text-center">
               <div className="w-32 h-32 mx-auto relative mb-4 flex items-center justify-center">
                   <div className="absolute inset-0 bg-[#FFF0F2] rounded-full opacity-60 scale-75"></div>
                   <svg className="w-20 h-20 text-[#6D1B2C] relative z-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
               </div>
               <h2 className="text-[18px] font-black text-[#131F33] mb-1">No mechanic was available.</h2>
               <p className="text-[13px] text-gray-500 font-medium mb-6">Please try booking again.</p>
               
               <button onClick={() => router.push('/dashboard')} className="w-full h-14 bg-[#6D1B2C] text-white rounded-[16px] font-bold text-[15px] flex items-center justify-center gap-2 mb-3 shadow-[0_8px_20px_rgb(109,27,44,0.2)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Try Again
               </button>
               <button onClick={() => router.push('/search')} className="w-full h-14 bg-white border border-[#6D1B2C] text-[#6D1B2C] rounded-[16px] font-bold text-[15px] flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                  Back to Services
               </button>

               <div className="mt-6 bg-[#FFF8EE] border border-[#FDE6C5] rounded-[16px] p-4 flex gap-3 text-left">
                  <div className="shrink-0 text-[#F5A623]">
                     <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>
                  </div>
                  <div>
                     <p className="text-[13px] font-black text-[#131F33] mb-0.5">Tip</p>
                     <p className="text-[11px] text-gray-500 font-medium leading-relaxed">You can try again in a few minutes or choose a different time slot.</p>
                  </div>
               </div>
            </div>
          </>
        )}

        {/* Active Booking Layout */}
        {booking.status !== 'EXPIRED' && booking.status !== 'CANCELLED' && (
          <>
            {/* Mechanic Profile */}
            {booking.mechanic && (
              <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4 flex justify-between items-center">
                 <div className="flex gap-4 items-center">
                    <div className="w-14 h-14 bg-[#FFF0F2] rounded-full flex items-center justify-center text-[#6D1B2C] text-[22px] font-black">
                       {booking.mechanic.name?.[0] || 'M'}
                    </div>
                    <div>
                       <h3 className="text-[16px] font-black text-[#131F33]">{booking.mechanic.name || 'Mechanic'}</h3>
                       <p className="text-[12px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                          <span className="text-[#F5A623]">★</span> 4.8 · 120 reviews
                       </p>
                    </div>
                 </div>
                 <a href={`tel:${booking.mechanic.phone}`} className="w-12 h-12 bg-[#10B981] rounded-full flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
                 </a>
              </div>
            )}

            {/* OTP Box */}
            {booking.otp && (
              <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4">
                <h3 className="text-[16px] font-black text-[#131F33]">Service OTP</h3>
                <p className="text-[12px] text-gray-500 font-medium mb-4">Share this with the mechanic to start the service.</p>
                <div className="flex justify-between gap-3">
                  {booking.otp.split('').map((digit: string, i: number) => (
                     <div key={i} className="flex-1 aspect-[4/5] bg-[#FFF0F2] rounded-[16px] flex items-center justify-center">
                        <span className="text-[32px] font-black text-[#6D1B2C]">{digit}</span>
                     </div>
                  ))}
                </div>
              </div>
            )}

            {/* Service Details */}
            <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4">
               <p className="text-[13px] font-black text-gray-400 mb-3">Service Details</p>
               <div className="flex justify-between items-center">
                 <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-[#FFF0F2] rounded-xl flex items-center justify-center text-[#6D1B2C]">
                       <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>
                    </div>
                    <div>
                       <h3 className="text-[14px] font-black text-[#131F33]">{serviceName}</h3>
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">BOOKED · ACCEPTED</p>
                    </div>
                 </div>
                 <div className="w-[1px] h-10 bg-gray-100 mx-2"></div>
                 <div className="text-right">
                    <h3 className="text-[16px] font-black text-[#131F33]">₹{serviceCost}</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Service Cost</p>
                 </div>
               </div>
            </div>
            
            {/* Additional Services Approval (also surfaced in the live sheet) */}
            <PendingApproval items={pendingAdditional} busy={busy} onRespond={respondAdditional} />

            {/* Billing */}
            {['READY_FOR_BILLING', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'].includes(booking.status) && booking.bill?.generatedAt && (
              <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 mb-4">
                 <p className="text-[13px] font-black text-gray-400 mb-3">Bill Details</p>
                 <BillRow label="Service charges" value={booking.bill.serviceCharges} />
                 {(booking.bill.breakdown && booking.bill.breakdown.length > 0
                   ? booking.bill.breakdown
                   : [
                       { label: 'GST', amount: booking.bill.gstAmount },
                       { label: 'Platform fee', amount: booking.bill.platformFee },
                     ]
                 ).map((line: any, i: number) => (
                   <BillRow key={i} label={line.label} value={line.amount} />
                 ))}
                 <div className="border-t border-dashed border-gray-200 my-3" />
                 <div className="flex justify-between items-center">
                   <span className="font-black text-[#131F33]">Total Payable</span>
                   <span className="font-black text-[#6D1B2C] text-xl">₹{booking.bill.totalAmount}</span>
                 </div>

                 {booking.status === 'READY_FOR_BILLING' && (
                   <div className="mt-5 space-y-3">
                     <button disabled={busy} onClick={payCash} className="w-full py-4 rounded-[16px] bg-[#6D1B2C] text-white font-bold text-[15px] disabled:opacity-50 shadow-sm">Pay with Cash</button>
                     <button disabled={busy} onClick={payRazorpay} className="w-full py-4 rounded-[16px] border border-[#6D1B2C] text-[#6D1B2C] font-bold text-[15px] disabled:opacity-50">Pay Online via UPI/Card</button>
                   </div>
                 )}
                 {booking.status === 'PAYMENT_PENDING' && booking.paymentMethod === 'CASH' && (
                   <div className="mt-5 bg-orange-50 border border-orange-100 p-4 rounded-[16px]">
                      <p className="text-[13px] font-bold text-orange-800 text-center">Please pay ₹{booking.bill.totalAmount} in cash to the mechanic. Waiting for mechanic confirmation...</p>
                   </div>
                 )}
                 {booking.status === 'PAYMENT_PENDING' && booking.paymentMethod === 'RAZORPAY' && (
                   <button disabled={busy} onClick={payRazorpay} className="mt-5 w-full py-4 rounded-[16px] bg-[#6D1B2C] text-white font-bold text-[15px] disabled:opacity-50">Complete Online Payment</button>
                 )}
              </div>
            )}

            {/* Cancel Button */}
            {['SEARCHING_MECHANIC', 'MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED'].includes(booking.status) && (
              <button onClick={cancelBooking} disabled={busy} className="w-full h-14 rounded-[16px] border border-[#E11D48] text-[#E11D48] font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform bg-white relative z-10 shadow-[0_8px_20px_rgb(225,29,72,0.1)]">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                 Cancel booking
              </button>
            )}

            {booking.status === 'COMPLETED' && !booking.ratingId && (
              <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-50 mb-4 text-center">
                 <h3 className="font-black text-[#131F33] mb-4">Service Completed! Rate your mechanic</h3>
                 <button onClick={() => router.push('/dashboard')} className="w-full py-4 bg-[#6D1B2C] text-white rounded-[16px] font-bold text-[15px]">Go back to Home</button>
              </div>
            )}
          </>
        )}
        
      </div>
    </div>
  );
}

function BillRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-[13px] text-gray-500 font-medium">{label}</span>
      <span className="text-[13px] font-bold text-[#131F33]">₹{value}</span>
    </div>
  );
}

// Extra services the mechanic proposed mid-job. The customer approves/rejects
// each; only approved ones get billed.
function PendingApproval({
  items,
  busy,
  onRespond,
}: {
  items: any[];
  busy: boolean;
  onRespond: (itemId: string, accept: boolean) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.06)] border border-[#F5A623] mb-4">
      <p className="text-[13px] font-black text-[#F5A623]">Approval needed</p>
      <p className="text-[12px] text-gray-500 font-medium mb-3">Your mechanic suggested extra work — approve to add it to the bill.</p>
      {items.map((s) => (
        <div key={s._id} className="mb-3 last:mb-0 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[14px] font-black text-[#131F33]">{s.name}</p>
            <p className="text-[14px] font-black text-[#131F33]">₹{s.priceSnapshot?.totalPrice ?? 0}</p>
          </div>
          {s.reason && <p className="text-[11px] text-gray-500 font-medium mb-3">Reason: {s.reason}</p>}
          <div className="flex gap-3">
            <button disabled={busy} onClick={() => onRespond(s._id, false)} className="flex-1 py-3 rounded-[16px] border border-gray-300 font-bold text-[14px] text-gray-700 disabled:opacity-50">Reject</button>
            <button disabled={busy} onClick={() => onRespond(s._id, true)} className="flex-1 py-3 rounded-[16px] bg-[#6D1B2C] text-white font-bold text-[14px] disabled:opacity-50">Approve</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] text-gray-500 font-bold">{children}</div>;
}

export default function BookingStatusScreen() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <BookingContent />
    </Suspense>
  );
}
