'use client';

import useSWR from 'swr';
import { ArrowDownLeft, ArrowUpRight, TrendingUp, Wallet as WalletIcon, AlertCircle } from 'lucide-react';
import { mechanicApi } from '@/lib/api';

const TYPE_LABEL: Record<string, string> = {
  SERVICE_EARNING: 'Service earning',
  PLATFORM_DUE: 'Company share (cash)',
  ADJUSTMENT: 'Adjustment',
  WITHDRAWAL: 'Withdrawal',
};

export default function WalletScreen() {
  const { data: wallet } = useSWR('wallet', () => mechanicApi.getWallet(), { refreshInterval: 20000 });
  const { data: txnResp } = useSWR('wallet/txns', () => mechanicApi.getWalletTransactions({ limit: 50 }), { refreshInterval: 20000 });

  const balance = wallet?.balance ?? 0;
  const lifetime = wallet?.lifetimeEarnings ?? 0;
  const owes = balance < 0;
  const txns = txnResp?.data || [];

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
              <span className="text-sm font-medium">{owes ? 'Amount you owe the platform' : 'Payout balance'}</span>
            </div>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {owes ? '−' : ''}₹{Math.abs(balance).toLocaleString('en-IN')}
            </p>
            <p className="mt-2 text-sm text-white/70">
              {owes
                ? 'Cash collected on the platform’s behalf (GST + platform fee). Settle to clear dues.'
                : 'Earnings from online payments, payable to you.'}
            </p>
          </div>
        </div>
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
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
          <p className="text-xs font-medium text-ink/55">Net Balance</p>
          <p className={`mt-0.5 text-xl font-extrabold ${owes ? 'text-red-600' : 'text-ink'}`}>{owes ? '−' : ''}₹{Math.abs(balance).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-7 px-5">
        <h3 className="mb-3 text-xl font-extrabold text-ink">Transactions</h3>
        {txns.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-ink/55">No transactions yet. Complete jobs to see earnings and dues here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {txns.map((txn: any, index: number) => {
              const credit = txn.direction === 'CREDIT';
              return (
                <div key={txn._id} className={`flex items-center gap-3 p-4 ${index !== txns.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${credit ? 'bg-green-50' : 'bg-red-50'}`}>
                    {credit ? <ArrowDownLeft className="h-5 w-5 text-green-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-ink">{txn.reason || TYPE_LABEL[txn.type] || txn.type}</h4>
                    <p className="truncate text-xs text-ink/50">
                      {new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {txn.affects === 'none' ? ' · not in balance' : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 font-extrabold ${credit ? 'text-green-600' : 'text-red-600'}`}>
                    {credit ? '+' : '−'}₹{Number(txn.amount).toLocaleString('en-IN')}
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
