'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, Landmark, CheckCircle2, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { mechanicApi } from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function StatusBadge({ status }: { status?: string }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Active
      </span>
    );
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
        <Clock className="h-3.5 w-3.5" /> Verifying
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-bold text-ink/50">
      Not added
    </span>
  );
}

export default function BankDetailsScreen() {
  const router = useRouter();
  const { data: bank, mutate, isLoading } = useSWR('bank-details', () => mechanicApi.getBankDetails());

  const [method, setMethod] = useState<'bank' | 'upi'>('bank');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [upiId, setUpiId] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prefill the fields that can be returned safely. The account number is
  // select:false server-side and never comes back, so it must be re-entered.
  useEffect(() => {
    if (!bank) return;
    setMethod(bank.payoutMethod === 'upi' ? 'upi' : 'bank');
    setAccountHolderName(bank.accountHolderName || '');
    setIfsc(bank.ifsc || '');
    setBankName(bank.bankName || '');
    setUpiId(bank.upiId || '');
  }, [bank]);

  const hasExisting = !!(bank?.accountLast4 || bank?.upiId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    setSaving(true);
    try {
      if (method === 'upi') {
        const vpa = upiId.trim();
        if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa)) {
          setSaving(false);
          return setError('Enter a valid UPI ID (e.g. name@okhdfc).');
        }
        await mechanicApi.updateBankDetails({
          payoutMethod: 'upi',
          upiId: vpa,
          accountHolderName: accountHolderName.trim() || undefined,
        });
      } else {
        const holder = accountHolderName.trim();
        const acc = accountNumber.replace(/\s+/g, '');
        const code = ifsc.trim().toUpperCase();
        if (!holder) { setSaving(false); return setError('Enter the account holder name.'); }
        if (!/^\d{9,18}$/.test(acc)) { setSaving(false); return setError('Enter a valid bank account number.'); }
        if (acc !== confirmAccountNumber.replace(/\s+/g, '')) { setSaving(false); return setError('Account numbers do not match.'); }
        if (!IFSC_RE.test(code)) { setSaving(false); return setError('Enter a valid IFSC code (e.g. HDFC0001234).'); }
        await mechanicApi.updateBankDetails({
          payoutMethod: 'bank',
          accountHolderName: holder,
          accountNumber: acc,
          ifsc: code,
          bankName: bankName.trim() || undefined,
        });
      }
      setAccountNumber('');
      setConfirmAccountNumber('');
      setSaved(true);
      await mutate();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not save payout details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 transition-colors active:bg-black/[0.05]"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <h1 className="text-xl font-extrabold text-ink">Bank &amp; Payouts</h1>
      </div>

      <div className="p-5 pb-12">
        {/* Current account summary */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.05] bg-primary-tint/40 p-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="font-extrabold text-ink">Payout Account</h2>
            </div>
            <StatusBadge status={isLoading ? undefined : bank?.status} />
          </div>
          <div className="p-4">
            {hasExisting ? (
              bank.payoutMethod === 'upi' ? (
                <>
                  <p className="text-[15px] font-semibold text-ink">{bank.accountHolderName || 'UPI'}</p>
                  <p className="mt-0.5 font-mono text-sm text-ink/60">{bank.upiId}</p>
                  <p className="mt-0.5 text-xs text-ink/45">Paid out via UPI</p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-semibold text-ink">{bank.accountHolderName}</p>
                  <p className="mt-0.5 font-mono text-sm text-ink/60">•••• •••• {bank.accountLast4}</p>
                  <p className="mt-0.5 text-sm text-ink/50">
                    {bank.bankName ? `${bank.bankName} · ` : ''}{bank.ifsc}
                  </p>
                </>
              )
            ) : (
              <p className="text-sm text-ink/55">
                No payout method yet. Add your bank account or UPI ID below so your earnings can be
                paid out to you.
              </p>
            )}
          </div>
        </div>

        {/* Bank / UPI toggle */}
        <div className="mb-4 inline-flex w-full rounded-2xl bg-black/[0.04] p-1">
          <button
            type="button"
            onClick={() => setMethod('bank')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${method === 'bank' ? 'bg-white text-primary shadow-sm' : 'text-ink/50'}`}
          >
            Bank Account
          </button>
          <button
            type="button"
            onClick={() => setMethod('upi')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-colors ${method === 'upi' ? 'bg-white text-primary shadow-sm' : 'text-ink/50'}`}
          >
            UPI ID
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Input
            label={method === 'upi' ? 'Name (optional)' : 'Account Holder Name'}
            placeholder={method === 'upi' ? 'Your name' : 'As printed on your passbook'}
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            autoCapitalize="words"
          />

          {method === 'upi' ? (
            <Input
              label="UPI ID"
              placeholder="e.g. yourname@okhdfc"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value.trim())}
              autoCapitalize="none"
              autoComplete="off"
            />
          ) : (
            <>
              <Input
                label="Account Number"
                placeholder={hasExisting && bank?.accountLast4 ? `Ending ${bank.accountLast4} — re-enter to update` : 'Bank account number'}
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                autoComplete="off"
              />
              <Input
                label="Confirm Account Number"
                placeholder="Re-enter account number"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                autoComplete="off"
                onPaste={(e) => e.preventDefault()}
              />
              <Input
                label="IFSC Code"
                placeholder="e.g. HDFC0001234"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                maxLength={11}
              />
              <Input
                label="Bank Name (optional)"
                placeholder="e.g. HDFC Bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}
          {saved && !error && (
            <div className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 p-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <p className="text-sm font-medium text-green-700">Bank details saved.</p>
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth isLoading={saving}>
            {hasExisting ? 'Update Payout Details' : 'Save Payout Details'}
          </Button>
        </form>

        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white p-4 shadow-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-xs font-medium leading-relaxed text-ink/55">
            Your account number is encrypted and never shown again — only the last 4 digits are
            displayed. It&apos;s used solely to pay out your online earnings.
          </p>
        </div>
      </div>
    </div>
  );
}
