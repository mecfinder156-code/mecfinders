"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setLoading(true);
    try {
      const { verificationId } = await login('+91' + phone); 
      // Store phone in session or pass via query params
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('temp_phone', phone);
        sessionStorage.setItem('temp_verificationId', verificationId);
      }
      router.push('/otp');
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden">
      
      {/* Top Header */}
      <div className="pt-14 px-6 pb-2 relative z-10">
        <h1 className="text-[22px] font-black text-[#6D1B2C] tracking-tight mb-0.5">Mecfinders.in</h1>
        <p className="text-[12px] text-gray-500 font-medium">Your Ride, Our Responsibility</p>
      </div>

      {/* Mechanic Graphic */}
      <div className="w-full flex-1 flex items-center justify-center relative mt-2 mb-4 z-0 pointer-events-none">
        <img src="/img/new/login_banner.png" alt="Mechanic" className="w-[110%] max-w-none h-auto object-cover opacity-95 mix-blend-multiply" />
      </div>

      {/* Form Section */}
      <div className="px-6 pb-8 z-10 bg-gradient-to-t from-white via-white to-transparent pt-10 mt-[-40px]">
        <h2 className="text-[32px] font-black text-[#131F33] tracking-tight mb-1">Welcome Back!</h2>
        <p className="text-[15px] text-gray-500 font-medium mb-8">Sign in to continue to MecFinders</p>

        <form onSubmit={handleContinue} className="w-full">
          {/* Phone Input */}
          <div className="flex gap-3 mb-6">
            <div className="flex items-center justify-center gap-2 px-4 bg-gray-50 border border-gray-200 rounded-2xl h-[56px] shrink-0">
               <span className="font-bold text-[#131F33] text-[15px]">+91</span>
               <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
            </div>
            <input 
              type="tel" 
              placeholder="Phone Number" 
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0,10))}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl h-[56px] px-4 font-bold text-[15px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] focus:bg-white transition-all placeholder:text-gray-400 placeholder:font-medium"
            />
          </div>

          <p className="text-[12px] text-gray-500 font-medium text-center mb-6 leading-relaxed px-4">
            We will send you a 6-digit one time password<br/>to verify your phone number.
          </p>

          <button 
            type="submit" 
            disabled={loading || phone.length < 10}
            className="w-full bg-[#6D1B2C] text-white rounded-[20px] h-[56px] font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgb(109,27,44,0.2)]"
          >
            {loading ? 'Sending...' : 'Continue'}
            {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 font-medium text-center mt-8">
          By continuing, you agree to our <Link href="/terms" className="text-[#6D1B2C] font-bold">Terms of Service</Link><br/>and <Link href="/privacy" className="text-[#6D1B2C] font-bold">Privacy Policy</Link>.
        </p>
      </div>

    </div>
  );
}
