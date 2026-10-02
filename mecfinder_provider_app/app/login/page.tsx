"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wrench, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 5) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const { verificationId } = await login(formattedPhone);
      router.push(`/otp?verificationId=${encodeURIComponent(verificationId)}&phone=${encodeURIComponent(formattedPhone)}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      {/* Brand hero */}
      <div className="relative flex flex-col items-center px-6 pt-20 pb-10">
        <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary-tint blur-2xl" />
        <div className="pointer-events-none absolute top-10 -left-20 h-56 w-56 rounded-full bg-accent/30 blur-2xl" />

        <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary shadow-xl shadow-primary/30">
          <span className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-extrabold text-accent-ink shadow">
            mF
          </span>
          <Wrench className="h-9 w-9 text-white" strokeWidth={2.2} />
        </div>
        <h1 className="relative mt-5 text-2xl font-extrabold tracking-tight text-primary">
          MecFinders <span className="text-ink/40">Provider</span>
        </h1>
      </div>

      {/* Sheet */}
      <div className="relative z-10 flex-1 rounded-t-[32px] bg-white px-6 pb-8 pt-9 shadow-[0_-8px_30px_rgba(109,27,44,0.06)]">
        <div className="mb-8">
          <h2 className="text-[28px] font-extrabold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1.5 text-[15px] font-medium text-ink/55">Sign in with your phone to keep earning.</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col">
          <label className="mb-2 text-xs font-bold uppercase tracking-wider text-ink/45">Phone Number</label>
          <div className="flex gap-3">
            <div className="flex h-[54px] w-20 items-center justify-center rounded-2xl border border-black/[0.08] bg-cream font-bold text-ink">
              +91
            </div>
            <div className="relative flex-1">
              <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink/35" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phoneNumber}
                onChange={(e) => { setPhoneNumber(e.target.value.replace(/\D/g, '')); setError(''); }}
                maxLength={15}
                className={`h-[54px] w-full rounded-2xl border bg-white pl-11 pr-4 text-base font-semibold tracking-wide text-ink outline-none transition-all placeholder:font-normal placeholder:text-ink/30 focus:ring-4 ${
                  error ? 'border-red-400 focus:ring-red-500/15' : 'border-black/[0.08] focus:border-primary focus:ring-primary/15'
                }`}
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}

          <p className="mt-3 text-center text-sm font-medium text-ink/45">
            We&apos;ll send a 6-digit OTP to verify your number.
          </p>

          <div className="pt-8">
            <Button type="submit" fullWidth size="lg" isLoading={isLoading}>
              Continue
            </Button>
            <p className="mt-6 text-center text-sm leading-relaxed text-ink/50">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="font-semibold text-primary">Terms of Service</Link> and{' '}
              <Link href="/privacy" className="font-semibold text-primary">Privacy Policy</Link>.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
