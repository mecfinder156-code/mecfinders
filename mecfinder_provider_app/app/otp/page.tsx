"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
      // Or we can manually check profile here, but redirecting to / is safer
      router.replace('/');
    } catch (err: any) {
      console.error(err);
      setError(true); // You might want to show actual err.message somewhere
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center p-6 pb-2">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Verify Phone</h1>
          <p className="text-gray-500">
            Code sent to <span className="font-semibold text-gray-900">{phone}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col">
          <div className="mb-8">
            <OTPInput 
              value={otp} 
              onChange={(val) => {
                setOtp(val);
                setError(false);
              }} 
              error={error} 
            />
            {error && (
              <p className="text-red-500 text-sm mt-3 text-center animate-fade-in-up">
                Please enter a valid 6-digit code.
              </p>
            )}
          </div>

          <div className="flex justify-center mb-8">
            {timeLeft > 0 ? (
              <p className="text-gray-500 text-sm font-medium">
                Resend code in <span className="text-primary">{formatTime(timeLeft)}</span>
              </p>
            ) : (
              <button 
                type="button"
                onClick={() => setTimeLeft(60)}
                className="text-primary font-semibold text-sm hover:underline"
              >
                Resend Code
              </button>
            )}
          </div>

          <div className="mt-auto pt-6 space-y-4">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
            >
              Verify & Continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OTPScreen() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-white"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <OTPForm />
    </Suspense>
  );
}

