'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { fetcher, type SupportQuery, type PaginationInfo } from '@/lib/api';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'] as const;

const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  ANSWERED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const ROLE_CLS: Record<string, string> = {
  customer: 'bg-blue-100 text-blue-700',
  mechanic: 'bg-purple-100 text-purple-700',
};

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportQueriesPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const qs = new URLSearchParams();
  qs.append('page', page.toString());
  qs.append('limit', '15');
  if (statusFilter) qs.append('status', statusFilter);
  if (roleFilter) qs.append('role', roleFilter);

  const swrKey = `/admin/support/queries?${qs.toString()}`;
  const { data, isLoading } = useSWR(swrKey, fetcher, { keepPreviousData: true });
  const queries: SupportQuery[] = data?.data || [];
  const pagination: PaginationInfo | null = data?.pagination || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Support Queries</h1>
        <p className="text-gray-500 text-sm mt-1">
          Questions raised by customers and providers from the mobile apps.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All users</option>
          <option value="customer">Customers</option>
          <option value="mechanic">Providers</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">From</th>
              <th className="px-6 py-4 font-medium text-gray-900">Subject</th>
              <th className="px-6 py-4 font-medium text-gray-900">Role</th>
              <th className="px-6 py-4 font-medium text-gray-900">Status</th>
              <th className="px-6 py-4 font-medium text-gray-900">Received</th>
              <th className="px-6 py-4 font-medium text-gray-900 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : queries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  No support queries found.
                </td>
              </tr>
            ) : (
              queries.map((q) => (
                <tr key={q._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{q.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{q.phone || q.email || ''}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-900 max-w-xs">
                    <p className="truncate">{q.subject}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                        ROLE_CLS[q.role] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {q.role === 'mechanic' ? 'provider' : q.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                        STATUS_CLS[q.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">{formatDate(q.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <Link
                        href={`/dashboard/support/queries/${q._id}`}
                        className="text-gray-500 hover:text-blue-600"
                        title="Open"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="p-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.pages}
              className="p-2 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
