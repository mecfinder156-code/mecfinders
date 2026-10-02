"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OTPInput } from '@/components/ui/OTPInput';
import { useAuth } from '../../contexts/AuthContext';

function OTPForm() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';
  const verificationId = searchParams.get('verificationId') || '';
  const { verifyOtp, refreshProfile } = useAuth();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) {
      setError(true);
      return;
    }

    setError(false);
    setIsLoading(true);

    try {
      await verifyOtp(otp, verificationId);
      await refreshProfile(); // Ensure profile is refreshed
      // Navigate to root to let the splash router handle dashboard vs register logic
      router.replace('/');
    } catch (err: any) {
      console.error(err);
      setError(true);
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      <div className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-primary-tint blur-2xl" />

      {/* Header */}
      <div className="relative z-10 px-6 pt-6">
        <button
          onClick={() => router.back()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm transition-transform active:scale-95"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-8 pt-8">
        <div className="mb-9 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary shadow-lg shadow-primary/25">
            <ShieldCheck className="h-8 w-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="mt-5 text-[28px] font-extrabold tracking-tight text-ink">Verify your number</h1>
          <p className="mt-2 text-[15px] font-medium text-ink/55">
            Enter the 6-digit code sent to
          </p>
          <p className="text-[15px] font-bold text-primary">{phone}</p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col">
          <div className="mb-6">
            <OTPInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                setError(false);
              }}
              error={error}
            />
            {error && (
              <p className="mt-3 text-center text-sm font-medium text-red-500">
                Please enter a valid 6-digit code.
              </p>
            )}
          </div>

          <div className="mb-8 flex justify-center">
            {timeLeft > 0 ? (
              <p className="text-sm font-medium text-ink/50">
                Resend code in <span className="font-bold text-primary">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setTimeLeft(60)}
                className="text-sm font-bold text-primary active:opacity-70"
              >
                Resend Code
              </button>
            )}
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            isLoading={isLoading}
          >
            Verify &amp; Continue
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function OTPScreen() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cream">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      }
    >
      <OTPForm />
    </Suspense>
  );
}
