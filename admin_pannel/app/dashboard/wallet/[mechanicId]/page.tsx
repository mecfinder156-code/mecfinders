'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { fetcher, walletApi, type WalletSummary, type WalletEarning, type MechanicPayout } from '@/lib/api';
import { ArrowLeft, TrendingUp, CheckCircle2, Clock, Landmark, Banknote } from 'lucide-react';

const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'OTHER', label: 'Other' },
];

export default function WalletDetailPage() {
  const params = useParams();
  const mechanicId = params?.mechanicId as string;
  const { mutate } = useSWRConfig();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const detailKey = mechanicId ? `/admin/wallets/${mechanicId}` : null;
  const { data: detailResp } = useSWR(detailKey, fetcher);
  const detail = detailResp?.data;
  const summary: WalletSummary | undefined = detail?.summary;
  const bank = detail?.bankDetails;
  const mechanic = detail?.mechanic;
  const payouts: MechanicPayout[] = detail?.payouts?.items || [];

  const eqs = new URLSearchParams();
  if (from) eqs.append('from', from);
  if (to) eqs.append('to', to);
  if (status) eqs.append('status', status);
  eqs.append('page', String(page));
  const earningsKey = mechanicId ? `/admin/wallets/${mechanicId}/earnings?${eqs.toString()}` : null;
  const { data: earningsResp, isLoading } = useSWR(earningsKey, fetcher, { keepPreviousData: true });
  const earnings: WalletEarning[] = earningsResp?.data || [];
  const pagination = earningsResp?.pagination;

  const selectedTotal = useMemo(
    () => earnings.filter((e) => selected.has(e._id)).reduce((s, e) => s + e.amount, 0),
    [earnings, selected]
  );
  const unpaidOnPage = earnings.filter((e) => e.payoutStatus === 'UNPAID');

  // Payout modal
  const [modalMode, setModalMode] = useState<'selected' | 'all' | null>(null);
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cash due the mechanic owes the platform + clear-due modal.
  const due: number = detail?.due ?? 0;
  const [dueOpen, setDueOpen] = useState(false);
  const [dueAmount, setDueAmount] = useState('');
  const [dueMethod, setDueMethod] = useState('CASH');
  const [dueRef, setDueRef] = useState('');
  const [dueBusy, setDueBusy] = useState(false);
  const [dueErr, setDueErr] = useState<string | null>(null);

  const openDueModal = () => {
    setDueAmount(String(due));
    setDueRef('');
    setDueErr(null);
    setDueOpen(true);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = unpaidOnPage.every((e) => next.has(e._id));
      unpaidOnPage.forEach((e) => (allSelected ? next.delete(e._id) : next.add(e._id)));
      return next;
    });

  const refresh = () => {
    mutate(detailKey);
    mutate(earningsKey);
    mutate('/admin/wallets/stats');
  };

  const submitPayout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload =
        modalMode === 'all'
          ? { settleAll: true, method, reference: reference || undefined, note: note || undefined }
          : { earningIds: Array.from(selected), method, reference: reference || undefined, note: note || undefined };
      await walletApi.createPayout(mechanicId, payload);
      setModalMode(null);
      setSelected(new Set());
      setReference('');
      setNote('');
      refresh();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not record the payout');
    } finally {
      setSubmitting(false);
    }
  };

  const PAYOUT_AMOUNT = modalMode === 'all' ? summary?.outstanding ?? 0 : selectedTotal;

  const submitClearDue = async () => {
    setDueBusy(true);
    setDueErr(null);
    try {
      const amt = dueAmount ? Number(dueAmount) : undefined;
      if (amt !== undefined && (!Number.isFinite(amt) || amt <= 0)) {
        setDueErr('Enter an amount greater than 0.');
        setDueBusy(false);
        return;
      }
      await walletApi.clearDue(mechanicId, {
        amount: amt,
        method: dueMethod,
        reference: dueRef || undefined,
      });
      setDueOpen(false);
      refresh();
    } catch (e: any) {
      setDueErr(e?.response?.data?.message || 'Could not update the due');
    } finally {
      setDueBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/wallet" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="h-4 w-4" /> Back to wallets
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{mechanic?.name || 'Mechanic'}</h1>
          <p className="text-gray-500">{mechanic?.phone || mechanic?.email || mechanicId}</p>
        </div>
        {(summary?.outstanding ?? 0) > 0 && (
          <button
            onClick={() => { setModalMode('all'); setError(null); }}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            <Banknote className="h-4 w-4" /> Settle all · {inr(summary?.outstanding ?? 0)}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 mb-2"><TrendingUp className="h-5 w-5" /></div>
          <p className="text-xs text-gray-500">Lifetime earnings</p>
          <p className="text-xl font-bold text-gray-900">{inr(summary?.lifetimeEarnings ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 mb-2"><Landmark className="h-5 w-5" /></div>
          <p className="text-xs text-gray-500">Payable (online)</p>
          <p className="text-xl font-bold text-gray-900">{inr(summary?.payableEarnings ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-600 mb-2"><CheckCircle2 className="h-5 w-5" /></div>
          <p className="text-xs text-gray-500">Paid out</p>
          <p className="text-xl font-bold text-green-700">{inr(summary?.paidOut ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 mb-2"><Clock className="h-5 w-5" /></div>
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-xl font-bold text-amber-700">{inr(summary?.outstanding ?? 0)}</p>
        </div>
      </div>

      {/* Cash due the mechanic owes the platform (GST + platform fee from cash
          bookings). Admin can clear it when the mechanic pays it back. */}
      {due > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div>
            <p className="text-xs font-medium text-red-600">Cash due owed to platform</p>
            <p className="text-xl font-bold text-red-700">{inr(due)}</p>
            <p className="text-xs text-red-600/80 mt-0.5">GST + platform-fee share collected as cash. Clear it when the mechanic pays it back.</p>
          </div>
          <button
            onClick={openDueModal}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <Banknote className="h-4 w-4" /> Clear due
          </button>
        </div>
      )}

      {/* Bank details for manual transfer */}
      {bank && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Payout details</h3>
          {bank.payoutMethod === 'upi' && bank.upiId ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Method</p><p className="text-gray-900 font-medium">UPI</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-gray-500">UPI ID</p><p className="text-gray-900 font-mono">{bank.upiId}</p></div>
              <div><p className="text-xs text-gray-500">Name</p><p className="text-gray-900">{bank.accountHolderName || '—'}</p></div>
            </div>
          ) : bank.accountLast4 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Method</p><p className="text-gray-900 font-medium">Bank</p></div>
              <div><p className="text-xs text-gray-500">Account holder</p><p className="text-gray-900">{bank.accountHolderName || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Account</p><p className="text-gray-900">•••• {bank.accountLast4}</p></div>
              <div><p className="text-xs text-gray-500">IFSC</p><p className="text-gray-900">{bank.ifsc || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Bank</p><p className="text-gray-900">{bank.bankName || '—'}</p></div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Mechanic hasn’t added bank/UPI details yet. Collect them before paying out.</p>
          )}
        </div>
      )}

      {/* Earnings */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900 mr-auto">Earnings</h3>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="px-3 py-1.5 border rounded-lg text-sm" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="px-3 py-1.5 border rounded-lg text-sm" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-1.5 border rounded-lg text-sm">
            <option value="">All</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PAID">Paid</option>
          </select>
          {(from || to || status) && (
            <button onClick={() => { setFrom(''); setTo(''); setStatus(''); setPage(1); }} className="text-sm text-gray-500 hover:underline">Clear</button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2.5 border-b border-amber-100">
            <span className="text-sm text-amber-800">{selected.size} selected · {inr(selectedTotal)}</span>
            <div className="flex gap-2">
              <button onClick={() => setSelected(new Set())} className="text-sm text-gray-600 hover:underline">Clear</button>
              <button onClick={() => { setModalMode('selected'); setError(null); }} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700">Mark paid</button>
            </div>
          </div>
        )}

        {isLoading && earnings.length === 0 ? (
          <div className="p-10 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
        ) : earnings.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No earnings for this filter.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={unpaidOnPage.length > 0 && unpaidOnPage.every((e) => selected.has(e._id))} onChange={toggleAllOnPage} disabled={unpaidOnPage.length === 0} />
                </th>
                <th className="px-4 py-3 font-medium text-gray-900">Date</th>
                <th className="px-4 py-3 font-medium text-gray-900">Booking</th>
                <th className="px-4 py-3 font-medium text-gray-900">Amount</th>
                <th className="px-4 py-3 font-medium text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {earnings.map((e) => {
                const booking = typeof e.bookingId === 'object' && e.bookingId ? e.bookingId : null;
                const paid = e.payoutStatus === 'PAID';
                return (
                  <tr key={e._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {!paid && <input type="checkbox" checked={selected.has(e._id)} onChange={() => toggle(e._id)} />}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {booking?.vehicle?.registrationNumber || (booking?._id ? booking._id.slice(-6) : '—')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{inr(e.amount)}</td>
                    <td className="px-4 py-3">
                      {paid ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Paid · {fmtDate(e.paidOutAt)}</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Unpaid</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Payout history */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Payout history</h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-gray-500">No payouts recorded yet.</p>
        ) : (
          <div className="divide-y">
            {payouts.map((p) => (
              <div key={p._id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inr(p.amount)} <span className="font-normal text-gray-500">· {p.earningsCount} earning{p.earningsCount > 1 ? 's' : ''}</span></p>
                  <p className="text-xs text-gray-500">
                    {fmtDate(p.paidAt)} · {p.method.replace('_', ' ').toLowerCase()}
                    {p.reference ? ` · ${p.reference}` : ''}
                    {p.createdBy?.name ? ` · by ${p.createdBy.name}` : ''}
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setModalMode(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Record payout</h3>
            <p className="mt-1 text-sm text-gray-500">
              Paying <span className="font-semibold text-gray-900">{inr(PAYOUT_AMOUNT)}</span> to {mechanic?.name}.
              {modalMode === 'all' ? ' This settles all outstanding earnings.' : ` This settles ${selected.size} earning(s).`}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference (UTR / UPI / cheque no.)</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={submitting} onClick={() => setModalMode(null)} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button disabled={submitting || PAYOUT_AMOUNT <= 0} onClick={submitPayout} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {submitting ? 'Saving…' : `Confirm · ${inr(PAYOUT_AMOUNT)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear-due modal */}
      {dueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !dueBusy && setDueOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">Clear cash due</h3>
            <p className="mt-1 text-sm text-gray-500">
              {mechanic?.name} owes <span className="font-semibold text-red-600">{inr(due)}</span>. Record how much
              they paid back — the due reduces by that amount (can&apos;t exceed what&apos;s owed).
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount received (₹)</label>
                <input
                  type="number"
                  min={1}
                  max={due}
                  value={dueAmount}
                  onChange={(e) => setDueAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder={String(due)}
                />
                <p className="mt-1 text-xs text-gray-400">Leave as is to clear the full due. More than {inr(due)} is capped.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                <select value={dueMethod} onChange={(e) => setDueMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reference (UTR / UPI / note)</label>
                <input value={dueRef} onChange={(e) => setDueRef(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            {dueErr && <p className="mt-3 text-sm text-red-600">{dueErr}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button disabled={dueBusy} onClick={() => setDueOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button disabled={dueBusy || due <= 0} onClick={submitClearDue} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {dueBusy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
