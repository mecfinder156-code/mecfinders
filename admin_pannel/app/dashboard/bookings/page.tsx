'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, bookingsApi } from '@/lib/api';
import { Eye } from 'lucide-react';

const STATUSES = [
  'CREATED', 'SEARCHING_MECHANIC', 'MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED',
  'READY_FOR_BILLING', 'PAYMENT_PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'EXPIRED',
];

const STATUS_CLS: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-red-100 text-red-700',
  WORK_STARTED: 'bg-indigo-100 text-indigo-700',
  SEARCHING_MECHANIC: 'bg-amber-100 text-amber-700',
};

export default function BookingsPage() {
  const [status, setStatus] = useState('');
  const [bookingType, setBookingType] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsResp } = useSWR('/admin/bookings/stats', fetcher);
  const stats = statsResp?.data;

  const qs = new URLSearchParams();
  if (status) qs.append('status', status);
  if (bookingType) qs.append('bookingType', bookingType);
  if (paymentStatus) qs.append('paymentStatus', paymentStatus);
  qs.append('page', String(page));
  const { data, isLoading } = useSWR(`/admin/bookings?${qs.toString()}`, fetcher, { keepPreviousData: true });
  const rows = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-500">All service bookings across the platform</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total bookings" value={stats.totalBookings} />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Revenue" value={`₹${(stats.revenue || 0).toLocaleString('en-IN')}`} />
          <StatCard label="Provider earnings" value={`₹${(stats.providerEarnings || 0).toLocaleString('en-IN')}`} />
          <StatCard label="Company amount" value={`₹${(stats.companyAmount || 0).toLocaleString('en-IN')}`} />
          <StatCard label="GST collected" value={`₹${(stats.gst || 0).toLocaleString('en-IN')}`} />
          <StatCard label="Platform fees" value={`₹${(stats.platformFee || 0).toLocaleString('en-IN')}`} />
          <StatCard label="Instant / Scheduled" value={`${stats.typeCounts?.INSTANT || 0} / ${stats.typeCounts?.SCHEDULED || 0}`} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={bookingType} onChange={(e) => { setBookingType(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All types</option>
          <option value="INSTANT">Instant</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>
        <select value={paymentStatus} onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All payments</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && rows.length === 0 ? (
          <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No bookings found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-900">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Mechanic</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Payment</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Amount</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((b: any) => (
                  <tr key={b._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{b.customer?.name || '—'}</td>
                    <td className="px-4 py-3">{b.mechanic?.name || <span className="text-gray-400">Unassigned</span>}</td>
                    <td className="px-4 py-3">{b.bookingType}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_CLS[b.status] || 'bg-gray-100 text-gray-700'}`}>
                        {b.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">{b.paymentMethod || '—'} · {b.paymentStatus}</td>
                    <td className="px-4 py-3 font-medium">₹{b.totalAmount || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(b.createdAt).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/bookings/${b._id}`} className="text-blue-600 inline-flex"><Eye className="h-4 w-4" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages} · {pagination.total} total</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Prev</button>
            <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
