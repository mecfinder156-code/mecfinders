'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { ArrowLeft } from 'lucide-react';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useSWR(id ? `/admin/bookings/${id}` : null, fetcher);
  const booking = data?.data?.booking;

  if (isLoading) return <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>;
  if (!booking) return <div className="p-10 text-center text-gray-500">Booking not found.</div>;

  const timeline = booking.timeline || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/bookings" className="text-gray-500"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking {String(booking._id).slice(-6).toUpperCase()}</h1>
          <p className="text-gray-500">{booking.bookingType} · <span className="font-medium">{booking.status.replace(/_/g, ' ')}</span></p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Customer">
          <Field label="Name" value={booking.customer?.name} />
          <Field label="Phone" value={booking.customer?.phone} />
        </Panel>
        <Panel title="Mechanic">
          <Field label="Name" value={booking.mechanic?.name || 'Unassigned'} />
          <Field label="Phone" value={booking.mechanic?.phone} />
          {booking.mechanic && <Field label="Rating" value={`${booking.mechanic.ratingAverage ?? 0} (${booking.mechanic.ratingCount ?? 0})`} />}
        </Panel>
        <Panel title="Vehicle">
          <Field label="Vehicle" value={[booking.vehicle?.make, booking.vehicle?.model].filter(Boolean).join(' ')} />
          <Field label="Reg. no" value={booking.vehicle?.registrationNumber} />
          <Field label="Category" value={booking.vehicle?.categoryName} />
        </Panel>
        <Panel title="Location">
          <Field label="Address" value={[booking.serviceLocation?.addressLine1, booking.serviceLocation?.city, booking.serviceLocation?.state].filter(Boolean).join(', ')} />
          <Field label="Type" value={booking.serviceLocation?.label} />
        </Panel>
      </div>

      {/* Services + bill */}
      <Panel title="Services & Bill">
        <div className="divide-y">
          {(booking.services || []).map((s: any) => (
            <div key={s._id} className="flex justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400 uppercase">{s.kind} · {s.status}</p>
              </div>
              <p className="font-medium">₹{s.priceSnapshot?.totalPrice}</p>
            </div>
          ))}
        </div>
        {booking.bill?.generatedAt && (
          <div className="mt-4 border-t pt-3 space-y-1 text-sm">
            <BillRow label="Service charges (provider earning)" value={booking.bill.serviceCharges} />
            {(booking.bill.breakdown || []).map((b: any, i: number) => <BillRow key={i} label={b.label} value={b.amount} />)}
            <BillRow label="Company amount" value={booking.bill.companyAmount} />
            <div className="flex justify-between font-bold pt-1"><span>Total</span><span>₹{booking.bill.totalAmount}</span></div>
          </div>
        )}
      </Panel>

      {/* Payment */}
      <Panel title="Payment">
        <Field label="Method" value={booking.paymentMethod} />
        <Field label="Status" value={booking.paymentStatus} />
      </Panel>

      {/* Timeline */}
      <Panel title="Status Timeline">
        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500">No events recorded.</p>
        ) : (
          <ol className="relative border-l border-gray-200 ml-2">
            {timeline.map((t: any) => (
              <li key={t._id} className="mb-5 ml-4">
                <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-1.5 mt-1.5" />
                <p className="text-sm font-medium text-gray-900">{t.event.replace(/_/g, ' ')}</p>
                {t.message && <p className="text-xs text-gray-500">{t.message}</p>}
                {(t.fromStatus || t.toStatus) && (
                  <p className="text-xs text-gray-400">{t.fromStatus || '—'} → {t.toStatus || '—'}</p>
                )}
                <time className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString('en-IN')}{t.actorRole ? ` · ${t.actorRole}` : ''}</time>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value || '—'}</span>
    </div>
  );
}
function BillRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="text-gray-900">₹{value}</span></div>
  );
}
