'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-500">
      {'★'.repeat(n)}<span className="text-gray-300">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function RatingsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR(`/admin/bookings/ratings?page=${page}`, fetcher, { keepPreviousData: true });
  const rows = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ratings & Feedback</h1>
        <p className="text-gray-500">Customer reviews of mechanics per completed booking</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && rows.length === 0 ? (
          <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No ratings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-900">Mechanic</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Customer</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Rating</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Feedback</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r: any) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{r.mechanicId?.name || '—'}</td>
                    <td className="px-4 py-3">{r.customerId?.name || '—'}</td>
                    <td className="px-4 py-3"><Stars n={r.rating} /></td>
                    <td className="px-4 py-3 text-gray-600 max-w-md">{r.feedback || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
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
