'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

const STATUS_CLS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-700',
};

export default function PaymentsPage() {
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(1);

  const qs = new URLSearchParams();
  if (status) qs.append('status', status);
  if (method) qs.append('method', method);
  qs.append('page', String(page));
  const { data, isLoading } = useSWR(`/admin/bookings/payments?${qs.toString()}`, fetcher, { keepPreviousData: true });
  const rows = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500">Cash and online payment records with the provider/company split</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
        </select>
        <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All methods</option>
          <option value="CASH">Cash</option>
          <option value="RAZORPAY">Razorpay</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && rows.length === 0 ? (
          <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No payments found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-900">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Mechanic</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Method</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Status</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Amount</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Provider</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Company</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((p: any) => (
                  <tr key={p._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{p.customerId?.name || '—'}</td>
                    <td className="px-4 py-3">{p.mechanicId?.name || '—'}</td>
                    <td className="px-4 py-3">{p.method}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${STATUS_CLS[p.status] || 'bg-gray-100 text-gray-700'}`}>{p.status}</span></td>
                    <td className="px-4 py-3 font-medium">₹{p.amount}</td>
                    <td className="px-4 py-3 text-green-700">₹{p.providerEarning || 0}</td>
                    <td className="px-4 py-3 text-blue-700">₹{p.companyAmount || 0}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.createdAt).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Prev</button>
            <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
