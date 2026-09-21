'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, MapPin, Phone, Plus, Check } from 'lucide-react';
import { mechanicApi, mechanicServicesApi } from '@/lib/api';
import { useMechanicLive } from '@/lib/useMechanicLive';
import { useLocationStream } from '@/lib/useLocationStream';
import LiveTrackingMap from '@/components/LiveTrackingMap';

// While in these states the mechanic is travelling to / working at the site,
// so we stream live GPS to the customer.
const TRACKING_STATUSES = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED'];

// The full-screen navigation map is only useful while the mechanic is EN ROUTE
// (or just arrived). Once work starts they're on-site and need the checklist,
// so WORK_STARTED falls through to the normal job layout below.
const MAP_STATUSES = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED'];

function JobContent() {
  const router = useRouter();
  const id = useSearchParams().get('id');

  const { data: booking, mutate } = useSWR(
    id ? `mechanic/booking/${id}` : null,
    () => mechanicApi.getBooking(id as string),
    { refreshInterval: 12000 }
  );
  useMechanicLive(() => {}, () => mutate(), id);

  // The mechanic's own live position, seeded from the GPS stream below so the
  // map can show where they are without a second watcher.
  const [selfLocation, setSelfLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Stream GPS to the customer while the job is active.
  useLocationStream(id, TRACKING_STATUSES.includes(booking?.status), setSelfLocation);

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await mutate();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (!id) return <Centered>Missing job reference.</Centered>;
  if (!booking) return <Centered>Loading job…</Centered>;

  const status = booking.status;
  const services = (booking.services || []).filter((s: any) => s.status !== 'REJECTED');

  const destination =
    typeof booking.serviceLocation?.latitude === 'number' &&
    typeof booking.serviceLocation?.longitude === 'number'
      ? { latitude: booking.serviceLocation.latitude, longitude: booking.serviceLocation.longitude }
      : null;

  const customerAddress = [booking.serviceLocation?.addressLine1, booking.serviceLocation?.city].filter(Boolean).join(', ');

  // ── En route to customer: full-screen native map + bottom sheet ──
  if (MAP_STATUSES.includes(status)) {
    return (
      <div className="fixed inset-0 bg-[#E9E4D8] overflow-hidden">
        <div className="absolute inset-0">
          <LiveTrackingMap self={selfLocation} destination={destination} statusText={status === 'MECHANIC_ARRIVED' ? 'You have arrived' : 'Navigating to customer'} />
        </div>

        {/* Floating back button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="absolute top-14 left-5 z-10 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center text-ink active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Bottom sheet */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-white rounded-t-[28px] shadow-[0_-8px_30px_rgb(0,0,0,0.12)] px-5 pt-4 pb-9 max-h-[72vh] overflow-y-auto">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />

          {error && <p className="text-sm text-red-600 font-semibold bg-red-50 rounded-xl p-3 mb-3">{error}</p>}

          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <p className="text-xs font-bold text-primary">
              {status === 'MECHANIC_ARRIVED' ? 'You have arrived · sharing live location' : 'Sharing your live location with the customer'}
            </p>
          </div>

          {/* Customer + destination */}
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0">
              <p className="font-extrabold text-ink truncate">{booking.customer?.name || 'Customer'}</p>
              <p className="text-sm text-ink/55 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{customerAddress || 'Destination'}</span></p>
              <p className="text-xs text-ink/45 mt-1">🚗 {[booking.vehicle?.make, booking.vehicle?.model, booking.vehicle?.registrationNumber].filter(Boolean).join(' · ')}</p>
            </div>
            {booking.customer?.phone && (
              <a href={`tel:${booking.customer.phone}`} className="w-12 h-12 shrink-0 rounded-full bg-green-500 text-white flex items-center justify-center active:scale-95 transition-transform ml-3"><Phone className="w-5 h-5" /></a>
            )}
          </div>

          {/* Assigned -> arrive */}
          {status === 'MECHANIC_ASSIGNED' && (
            <button disabled={busy} onClick={() => run(() => mechanicApi.arrive(id))} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50 active:scale-[0.98] transition-transform">I&apos;ve Arrived</button>
          )}

          {/* Arrived -> OTP start */}
          {status === 'MECHANIC_ARRIVED' && (
            <div className="bg-[#FBFBFC] rounded-2xl p-4 border border-gray-100">
              <p className="font-bold text-ink mb-1">Enter Service OTP</p>
              <p className="text-sm text-ink/55 mb-3">Ask the customer for their 4-digit OTP to start the service.</p>
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="••••" className="w-full text-center text-2xl font-black tracking-[0.5em] border border-gray-200 rounded-xl py-3 mb-3" />
              <button disabled={busy || otp.length < 4} onClick={() => run(() => mechanicApi.startWork(id, otp))} className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Verify &amp; Start Work</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      {/* Header */}
      <div className="bg-primary px-5 pt-14 pb-6 text-white rounded-b-[26px]">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60 font-bold">Job · {booking.bookingType}</p>
            <h1 className="text-xl font-extrabold">{status.replace(/_/g, ' ')}</h1>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-3 space-y-4">
        {error && <p className="text-sm text-red-600 font-semibold bg-red-50 rounded-xl p-3">{error}</p>}

        {/* Customer + location */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-extrabold text-ink">{booking.customer?.name || 'Customer'}</p>
              <p className="text-sm text-ink/55 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{[booking.serviceLocation?.addressLine1, booking.serviceLocation?.city].filter(Boolean).join(', ')}</p>
            </div>
            {booking.customer?.phone && (
              <a href={`tel:${booking.customer.phone}`} className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center"><Phone className="w-5 h-5" /></a>
            )}
          </div>
          <p className="text-sm text-ink/55 mt-2">🚗 {[booking.vehicle?.make, booking.vehicle?.model, booking.vehicle?.registrationNumber].filter(Boolean).join(' · ')}</p>
        </div>

        {/* Live location sharing indicator */}
        {TRACKING_STATUSES.includes(status) && (
          <div className="flex items-center gap-2 rounded-2xl bg-primary-tint px-4 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <p className="text-xs font-bold text-primary">Sharing your live location with the customer</p>
          </div>
        )}

        {/* Assigned -> arrive */}
        {status === 'MECHANIC_ASSIGNED' && (
          <button disabled={busy} onClick={() => run(() => mechanicApi.arrive(id))} className="w-full py-3.5 rounded-xl bg-primary text-white font-bold disabled:opacity-50">I&apos;ve Arrived</button>
        )}

        {/* Arrived -> OTP start */}
        {status === 'MECHANIC_ARRIVED' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-bold text-ink mb-1">Enter Service OTP</p>
            <p className="text-sm text-ink/55 mb-3">Ask the customer for their 4-digit OTP to start the service.</p>
            <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="••••" className="w-full text-center text-2xl font-black tracking-[0.5em] border border-gray-200 rounded-xl py-3 mb-3" />
            <button disabled={busy || otp.length < 4} onClick={() => run(() => mechanicApi.startWork(id, otp))} className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Verify & Start Work</button>
          </div>
        )}

        {/* Services + checklist */}
        {['WORK_STARTED', 'READY_FOR_BILLING', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'].includes(status) && (
          <div className="space-y-3">
            {services.map((s: any) => (
              <div key={s._id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="font-bold text-ink">{s.name}</p>
                    <p className="text-[11px] uppercase font-semibold text-ink/40">{s.kind === 'ORIGINAL' ? 'Booked' : 'Additional'} · {s.status}</p>
                  </div>
                  <p className="font-bold text-ink">₹{s.priceSnapshot?.totalPrice}</p>
                </div>
                {s.status === 'REQUESTED' && (
                  <p className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-2 py-1">Waiting for customer approval…</p>
                )}
                {['ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].includes(s.status) && s.checklist?.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {s.checklist.map((c: any) => (
                      <button
                        key={c._id}
                        disabled={busy || status !== 'WORK_STARTED'}
                        onClick={() => run(() => mechanicApi.updateChecklistItem(s._id, c._id, !c.done))}
                        className="w-full flex items-center gap-2 text-left disabled:opacity-70"
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${c.done ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>{c.done && <Check className="w-3.5 h-3.5" />}</span>
                        <span className={`text-sm ${c.done ? 'text-ink/40 line-through' : 'text-ink'}`}>{c.label}{c.required && !c.done ? ' *' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add additional service */}
        {status === 'WORK_STARTED' && (
          <>
            <button onClick={() => setAddOpen(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add Additional Service</button>
            <button disabled={busy} onClick={() => run(() => mechanicApi.complete(id))} className="w-full py-3.5 rounded-xl bg-ink text-white font-bold disabled:opacity-50">Complete Work</button>
          </>
        )}

        {/* Bill */}
        {['READY_FOR_BILLING', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'].includes(status) && booking.bill?.generatedAt && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-bold text-ink mb-2">Bill</p>
            <Row label="Service charges (your earning)" value={booking.bill.serviceCharges} strong />
            {(booking.bill.breakdown && booking.bill.breakdown.length > 0
              ? booking.bill.breakdown
              : [
                  { label: 'GST', amount: booking.bill.gstAmount },
                  { label: 'Platform fee', amount: booking.bill.platformFee },
                ]
            ).map((line: any, i: number) => (
              <Row key={i} label={line.label} value={line.amount} />
            ))}
            <div className="border-t border-gray-100 my-2" />
            <Row label="Total (customer pays)" value={booking.bill.totalAmount} strong />
            {status === 'READY_FOR_BILLING' && (
              <p className="text-sm text-ink/55 mt-3 text-center">Waiting for the customer to choose a payment method…</p>
            )}
            {status === 'PAYMENT_PENDING' && booking.paymentMethod === 'CASH' && (
              <button disabled={busy} onClick={() => run(() => mechanicApi.collectCash(id))} className="mt-3 w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50">Confirm Cash Collected (₹{booking.bill.totalAmount})</button>
            )}
            {status === 'PAYMENT_PENDING' && booking.paymentMethod === 'RAZORPAY' && (
              <p className="text-sm text-ink/55 mt-3 text-center">Customer is paying online…</p>
            )}
          </div>
        )}

        {['PAID', 'COMPLETED'].includes(status) && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center"><Check className="w-7 h-7" /></div>
            <p className="font-extrabold text-ink">Job Completed</p>
            <p className="text-sm text-ink/55">Payment received. Great work!</p>
          </div>
        )}
      </div>

      {addOpen && (
        <AddServiceSheet
          vehicleCategoryId={booking.vehicle?.vehicleCategoryId}
          onClose={() => setAddOpen(false)}
          onAdd={async (mechanicServiceId, reason) => {
            await run(() => mechanicApi.addAdditionalService(id, mechanicServiceId, reason));
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddServiceSheet({ vehicleCategoryId, onClose, onAdd }: { vehicleCategoryId?: string; onClose: () => void; onAdd: (id: string, reason: string) => Promise<void> }) {
  const { data: services } = useSWR('mechanic-services-catalog', () =>
    mechanicServicesApi.getAll(vehicleCategoryId ? { vehicleCategoryId } : undefined)
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full bg-white rounded-t-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100"><p className="font-extrabold text-ink text-lg">Add Additional Service</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {(services || []).map((s: any) => (
            <button key={s._id} onClick={() => setSelected(s._id)} className={`w-full text-left p-3 rounded-xl border flex justify-between items-center ${selected === s._id ? 'border-primary bg-primary-tint' : 'border-gray-200'}`}>
              <span className="font-bold text-ink">{s.name}</span>
              <span className="font-bold text-ink">₹{s.pricing?.totalPrice ?? '—'}</span>
            </button>
          ))}
          {services && services.length === 0 && <p className="text-sm text-ink/50 text-center py-6">No additional services available for this vehicle.</p>}
        </div>
        <div className="p-4 border-t border-gray-100 space-y-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. brake pads worn)" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
          <button
            disabled={!selected || busy}
            onClick={async () => { setBusy(true); try { await onAdd(selected as string, reason); } finally { setBusy(false); } }}
            className="w-full py-3 rounded-xl bg-primary text-white font-bold disabled:opacity-50"
          >
            Request from Customer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={`text-sm ${strong ? 'font-bold text-ink' : 'text-ink/55'}`}>{label}</span>
      <span className={`text-sm ${strong ? 'font-extrabold text-ink' : 'font-semibold text-ink'}`}>₹{value}</span>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-cream text-ink/50 font-medium">{children}</div>;
}

export default function JobScreen() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <JobContent />
    </Suspense>
  );
}
