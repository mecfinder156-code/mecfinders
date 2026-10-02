'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, walletApi, type WalletRow, type WalletPlatformStats } from '@/lib/api';
import { Wallet, TrendingUp, CheckCircle2, Clock, Search, ChevronRight } from 'lucide-react';

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${tone} mb-3`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function WalletListPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: statsResp } = useSWR('/admin/wallets/stats', fetcher);
  const stats: WalletPlatformStats | undefined = statsResp?.data;

  const qs = new URLSearchParams();
  if (search) qs.append('q', search);
  qs.append('page', String(page));
  const { data, isLoading } = useSWR(`/admin/wallets?${qs.toString()}`, fetcher, { keepPreviousData: true });
  const rows: WalletRow[] = data?.data || [];
  const pagination = data?.pagination;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(q.trim());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mechanic Wallets</h1>
        <p className="text-gray-500">
          Online earnings held by the platform, per mechanic. Settle outstanding amounts and mark them paid.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Earned (online)" value={inr(stats?.totalEarned ?? 0)} icon={TrendingUp} tone="bg-blue-50 text-blue-600" />
        <StatCard label="Total Paid Out" value={inr(stats?.totalPaid ?? 0)} icon={CheckCircle2} tone="bg-green-50 text-green-600" />
        <StatCard label="Outstanding to Pay" value={inr(stats?.totalOutstanding ?? 0)} icon={Clock} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Mechanics" value={String(stats?.mechanicsWithEarnings ?? 0)} icon={Wallet} tone="bg-purple-50 text-purple-600" />
      </div>

      <form onSubmit={submitSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mechanic by name or phone"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Search
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading && rows.length === 0 ? (
          <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No mechanic earnings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-900">Mechanic</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Earned</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Paid</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Outstanding</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Due (cash)</th>
                  <th className="px-4 py-3 font-medium text-gray-900">Bank</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.mechanicId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.phone || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{inr(r.earned)}</td>
                    <td className="px-4 py-3 text-green-700">{inr(r.paid)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${r.outstanding > 0 ? 'text-amber-700' : 'text-gray-500'}`}>{inr(r.outstanding)}</span>
                      {r.unpaidCount > 0 && <span className="ml-1 text-xs text-gray-400">({r.unpaidCount})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${r.due > 0 ? 'text-red-600' : 'text-gray-400'}`}>{inr(r.due)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${r.bankStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : r.bankStatus === 'NOT_SUBMITTED' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                        {r.bankLast4 ? `•••• ${r.bankLast4}` : r.bankStatus.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/wallet/${r.mechanicId}`} className="inline-flex items-center gap-1 text-blue-600 font-medium hover:underline">
                        {r.outstanding > 0 ? 'Settle' : 'View'} <ChevronRight className="h-4 w-4" />
                      </Link>
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
