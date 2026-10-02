"use client";

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function OtpScreen() {
  const router = useRouter();
  const { verifyOtp } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [timer, setTimer] = useState(60);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPhone = sessionStorage.getItem('temp_phone');
      if (storedPhone) setPhone(storedPhone);
      else router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6) return;
    
    setLoading(true);
    try {
      const vId = sessionStorage.getItem('temp_verificationId') || '';
      const { exists } = await verifyOtp(otpString, vId);
      // Existing customer → permissions gate (then home); brand-new phone → register.
      router.replace(exists ? '/permissions' : '/register');
    } catch (err) {
      console.error(err);
      setLoading(false);
      // Reset OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden">
      
      <div className="flex-1 flex flex-col relative z-10">
        
        {/* Top Header & Back */}
        <div className="pt-14 px-6 relative">
          <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33] mb-6 hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          
          <div className="flex justify-between items-start">
            <div className="mt-2">
              <h1 className="text-[22px] font-black text-[#6D1B2C] tracking-tight mb-0.5">Mecfinders.in</h1>
              <p className="text-[12px] text-gray-500 font-medium">Your Ride, Our Responsibility</p>
            </div>
            
            <div className="absolute right-[-10px] top-10 w-[160px] h-32 pointer-events-none">
              <img src="/img/new/otp_upper.png" alt="OTP Illustration" className="w-full h-full object-contain mix-blend-multiply" />
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div className="px-6 pt-16">
          <h2 className="text-[32px] font-black text-[#131F33] tracking-tight mb-1">Verify Phone</h2>
          <p className="text-[15px] text-gray-500 font-medium mb-10">
            Code sent to <span className="font-bold text-[#131F33]">+91 {phone}</span>
          </p>

          <form onSubmit={handleSubmit}>
            
            {/* OTP Boxes */}
            <div className="flex justify-between gap-2 mb-8">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 bg-gray-50 border border-gray-200 rounded-[14px] text-center text-xl font-black text-[#131F33] focus:outline-none focus:border-[#6D1B2C] focus:bg-white transition-all shadow-sm"
                />
              ))}
            </div>

            <p className="text-[13px] text-gray-400 font-medium text-center mb-8">
              Resend code in <span className="text-[#E65100] font-bold">{formatTime(timer)}</span>
            </p>

            <button 
              type="submit" 
              disabled={loading || otp.join('').length < 6}
              className="w-full bg-[#6D1B2C] text-white rounded-[20px] h-[56px] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgb(109,27,44,0.2)] relative z-10"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
              {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
