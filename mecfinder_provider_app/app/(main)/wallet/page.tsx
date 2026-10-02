'use client';

import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet as WalletIcon, AlertCircle, Clock, CheckCircle2, Landmark, CalendarRange } from 'lucide-react';
import { mechanicApi } from '@/lib/api';

const TYPE_LABEL: Record<string, string> = {
  SERVICE_EARNING: 'Service earning',
  PLATFORM_DUE: 'Company share (cash)',
  DUE_CLEARED: 'Due cleared',
  PAYOUT: 'Payout received',
  ADJUSTMENT: 'Adjustment',
  WITHDRAWAL: 'Withdrawal',
};

type Period = { key: string; label: string; from?: string; to?: string };

/** `YYYY-MM-DD` in local time (the backend treats a bare date as a full day). */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Filter options for the wallet: "All time" plus the last 12 calendar months.
 * The current and previous months get friendly "This / Last month" labels.
 */
function buildPeriods(): Period[] {
  const periods: Period[] = [{ key: 'all', label: 'All time' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of that month
    const month = start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    const label = i === 0 ? `This month · ${month}` : i === 1 ? `Last month · ${month}` : month;
    periods.push({ key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`, label, from: ymd(start), to: ymd(end) });
  }
  return periods;
}

// Load the Razorpay checkout script once, on demand.
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

function SettlementBadge({ status }: { status?: string }) {
  if (status === 'UNPAID') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        <Clock className="h-3 w-3" /> Pending payout
      </span>
    );
  }
  if (status === 'PAID') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Paid out
      </span>
    );
  }
  return null;
}

export default function WalletScreen() {
  const { mutate } = useSWRConfig();

  // Month filter: default to the current month so "monthly" earnings show first.
  const periods = buildPeriods();
  const [periodKey, setPeriodKey] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const period = periods.find((p) => p.key === periodKey) || periods[0];
  const { from, to } = period;

  const { data: wallet } = useSWR(['wallet', from ?? '', to ?? ''], () => mechanicApi.getWallet({ from, to }), { refreshInterval: 20000 });
  const { data: txnResp } = useSWR(['wallet/txns', from ?? '', to ?? ''], () => mechanicApi.getWalletTransactions({ limit: 50, from, to }), { refreshInterval: 20000 });

  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balance = wallet?.balance ?? 0;
  const summary = wallet?.summary;
  const lifetime = summary?.lifetimeEarnings ?? wallet?.lifetimeEarnings ?? 0;
  const outstanding = summary?.outstanding ?? 0;
  const paidOut = summary?.paidOut ?? 0;
  const owes = balance < 0;
  const due = owes ? Math.abs(balance) : 0;
  const txns = txnResp?.data || [];

  // Earnings for the selected month (all-time falls back to lifetime total).
  const periodEarned = period.key === 'all' ? lifetime : summary?.earnedInRange?.total ?? 0;
  const periodJobs = period.key === 'all' ? null : summary?.earnedInRange?.count ?? 0;
  const periodShort = period.key === 'all' ? 'All time' : period.label.split('·').pop()!.trim();

  // Invalidate every period's cached wallet/txns after a due payment.
  const refreshWallet = () =>
    mutate((key) => Array.isArray(key) && (key[0] === 'wallet' || key[0] === 'wallet/txns'));

  const clearDue = async () => {
    setError(null);
    setClearing(true);
    try {
      const order = await mechanicApi.initiateDueSettlement();
      const verify = (resp: any) =>
        mechanicApi.verifyDueSettlement({
          orderId: resp.razorpay_order_id,
          paymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        });
      const options: any = {
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: 'INR',
        name: 'MecFinders',
        description: 'Clear platform due',
        order_id: order.orderId,
        theme: { color: '#6D1B2C' },
      };

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        // Native Razorpay SDK → UPI (GPay/PhonePe intent) works, unlike the web
        // checkout inside a WebView.
        const { Checkout } = await import('capacitor-razorpay');
        const result: any = await (Checkout as any).open(options);
        const resp = typeof result?.response === 'string' ? JSON.parse(result.response) : result?.response || result;
        await verify(resp);
        refreshWallet();
      } else {
        const ok = await loadRazorpay();
        if (!ok) throw new Error('Could not load the payment gateway. Check your connection.');
        const rzp = new (window as any).Razorpay({
          ...options,
          handler: async (response: any) => {
            try {
              await verify(response);
            } finally {
              refreshWallet();
            }
          },
        });
        rzp.on('payment.failed', () => setError('Payment failed. Please try again.'));
        rzp.open();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.error?.description || e?.message || '';
      if (msg && !/cancel/i.test(String(msg))) setError(msg || 'Could not start payment');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-full bg-cream pb-6">
      <div className="flex items-start justify-between px-5 pt-6">
        <div>
          <h1 className="text-[26px] font-extrabold leading-none text-primary">Wallet</h1>
          <p className="mt-1 text-sm text-ink/50">Your earnings &amp; dues</p>
        </div>
      </div>

      {/* Balance card */}
      <div className="px-5 pt-5">
        <div className={`relative overflow-hidden rounded-3xl p-6 text-white shadow-xl ${owes ? 'bg-red-600 shadow-red-600/25' : 'bg-primary shadow-primary/25'}`}>
          <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/70">
              <WalletIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{owes ? 'Amount you owe the platform' : 'Pending payout'}</span>
            </div>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {owes ? '−' : ''}₹{(owes ? Math.abs(balance) : outstanding).toLocaleString('en-IN')}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {owes
                ? 'Cash collected on the platform’s behalf (GST + platform fee). Settle to clear dues.'
                : 'Online earnings are collected by MecFinders and paid to you by our team. This is what’s due to you now.'}
            </p>

            {owes && (
              <button
                onClick={clearDue}
                disabled={clearing}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-red-600 shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {clearing ? 'Starting…' : `Clear Due · ₹${due.toLocaleString('en-IN')}`}
              </button>
            )}
          </div>
        </div>
        {error && <p className="mt-2 px-1 text-sm font-medium text-red-600">{error}</p>}
      </div>

      {/* Summary tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-green-50">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-xs font-medium text-ink/55">Lifetime Earnings</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">₹{lifetime.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint">
            {owes ? <AlertCircle className="h-5 w-5 text-primary" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
          </div>
          <p className="text-xs font-medium text-ink/55">{owes ? 'Due to Platform' : 'Paid out to you'}</p>
          <p className={`mt-0.5 text-xl font-extrabold ${owes ? 'text-red-600' : 'text-ink'}`}>{owes ? '−' : ''}₹{(owes ? Math.abs(balance) : paidOut).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Earnings + month filter */}
      <div className="mt-5 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarRange className="h-4 w-4 text-primary" />
              Earnings
            </div>
            <div className="relative">
              <select
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                className="appearance-none rounded-xl border border-primary/15 bg-cream py-1.5 pl-3 pr-8 text-sm font-semibold text-ink outline-none focus:border-primary"
              >
                {periods.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-ink/55">{period.key === 'all' ? 'Total earned' : `Earned in ${periodShort}`}</p>
              <p className="mt-0.5 text-3xl font-extrabold text-ink">₹{Number(periodEarned).toLocaleString('en-IN')}</p>
            </div>
            {periodJobs !== null && (
              <span className="rounded-full bg-primary-tint px-3 py-1 text-xs font-bold text-primary">
                {periodJobs} {periodJobs === 1 ? 'job' : 'jobs'}
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-ink/45">
            Lifetime total ₹{lifetime.toLocaleString('en-IN')} · cash &amp; online jobs
          </p>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-7 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-ink">Transactions</h3>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink/55 shadow-sm">{periodShort}</span>
        </div>
        {txns.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-ink/55">
              {period.key === 'all'
                ? 'No transactions yet. Complete jobs to see earnings and dues here.'
                : `No transactions in ${periodShort}.`}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {txns.map((txn: any, index: number) => {
              const credit = txn.direction === 'CREDIT';
              // Online earnings are held by the platform and paid out by admin;
              // show the payout journey rather than a misleading "added to balance".
              const online = txn.type === 'SERVICE_EARNING' && txn.payoutStatus && txn.payoutStatus !== 'NA';
              // The actual disbursement event (platform -> you).
              const payout = txn.type === 'PAYOUT';
              const positive = payout; // payouts are money reaching you
              return (
                <div key={txn._id} className={`flex items-center gap-3 p-4 ${index !== txns.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${online || payout ? 'bg-primary-tint' : credit ? 'bg-green-50' : 'bg-red-50'}`}>
                    {online || payout ? (
                      <Landmark className="h-5 w-5 text-primary" />
                    ) : credit ? (
                      <ArrowDownLeft className="h-5 w-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-ink">{txn.reason || TYPE_LABEL[txn.type] || txn.type}</h4>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-xs text-ink/50">
                        {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {!online && !payout && txn.affects === 'none' ? ' · not in balance' : ''}
                      </p>
                      {online && <SettlementBadge status={txn.payoutStatus} />}
                    </div>
                  </div>
                  <span className={`shrink-0 font-extrabold ${online ? 'text-primary' : payout ? 'text-green-600' : credit ? 'text-green-600' : 'text-red-600'}`}>
                    {online ? '' : positive ? '+' : credit ? '+' : '−'}₹{Number(txn.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
