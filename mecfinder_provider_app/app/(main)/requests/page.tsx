'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { MapPin, Clock, Inbox } from 'lucide-react';
import { mechanicApi } from '@/lib/api';
import { useMechanicLive } from '@/lib/useMechanicLive';

const ACTIVE = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED', 'READY_FOR_BILLING', 'PAYMENT_PENDING'];

const STATUS_COLOR: Record<string, string> = {
  MECHANIC_ASSIGNED: 'bg-blue-100 text-blue-700',
  MECHANIC_ARRIVED: 'bg-blue-100 text-blue-700',
  WORK_STARTED: 'bg-amber-100 text-amber-700',
  READY_FOR_BILLING: 'bg-orange-100 text-orange-700',
  PAYMENT_PENDING: 'bg-orange-100 text-orange-700',
  PAID: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-red-100 text-red-700',
};

export default function RequestsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const { data, mutate } = useSWR('mechanic/all-bookings', () => mechanicApi.listBookings({ limit: 50 }), {
    refreshInterval: 20000,
  });
  useMechanicLive(() => {}, () => mutate());

  const all = data?.data || [];
  const list = all.filter((b: any) => (tab === 'active' ? ACTIVE.includes(b.status) : !ACTIVE.includes(b.status)));

  return (
    <div className="flex h-full flex-col bg-cream">
      <div className="px-5 pt-6">
        <h1 className="text-[26px] font-extrabold leading-none text-primary">Service Requests</h1>
        <p className="mt-1 text-sm text-ink/50">Manage your active and past jobs</p>

        <div className="mt-4 flex rounded-xl bg-black/[0.04] p-1">
          <button onClick={() => setTab('active')} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-ink/50'}`}>
            Active
          </button>
          <button onClick={() => setTab('past')} className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${tab === 'past' ? 'bg-white text-primary shadow-sm' : 'text-ink/50'}`}>
            Past
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {list.length > 0 ? (
          list.map((b: any) => {
            const original = (b.services || []).find((s: any) => s.kind === 'ORIGINAL') || b.services?.[0];
            return (
              <button key={b._id} onClick={() => router.push(`/job?id=${b._id}`)} className="w-full text-left rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99] transition-transform">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-2xl">🔧</div>
                    <div>
                      <h3 className="font-bold text-ink">{original?.name || 'Service'}</h3>
                      <p className="text-sm font-medium text-ink/55">{b.customer?.name}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[b.status] || 'bg-gray-100 text-gray-600'}`}>
                    {b.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start text-sm text-ink/55">
                    <MapPin className="mr-2 mt-0.5 h-4 w-4 shrink-0 text-ink/40" />
                    <span>{[b.serviceLocation?.addressLine1, b.serviceLocation?.city].filter(Boolean).join(', ')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-ink/55">
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 shrink-0 text-ink/40" />
                      <span>{new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <span className="font-extrabold text-green-600">₹{b.bill?.totalAmount || original?.priceSnapshot?.totalPrice || 0}</span>
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-ink/40">
            <Inbox className="mb-3 h-12 w-12 text-ink/20" />
            <p className="font-medium">No {tab} jobs</p>
          </div>
        )}
      </div>
    </div>
  );
}
