"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function SplashScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (!user) {
        router.replace('/login');
      } else if (!profile) {
        router.replace('/register');
      } else {
        router.replace('/permissions');
      }
    }, 2000); // 2 second splash
    return () => clearTimeout(timer);
  }, [loading, user, profile, router]);

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen bg-[#FDFDFD] overflow-hidden font-sans pt-12 pb-10">
      
      {/* Top Section */}
      <div className="flex flex-col items-center z-10 w-full px-6 mt-4">
        {/* Logo */}
        <div className="relative mb-4">
          <div className="w-28 h-28 bg-[#FFF0F2] rounded-full flex items-center justify-center border-4 border-white shadow-sm">
             <svg className="w-14 h-14 text-[#4A5568]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
             </svg>
             <svg className="w-8 h-8 text-[#6D1B2C] absolute transform rotate-45" style={{ top: '45%', left: '45%' }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.7,19.3L17,13.6c0.6-1.7,0.3-3.7-0.9-5.1c-1.5-1.7-4.1-2.1-6.1-1l1.8,1.8l-1.4,4.2l-4.2,1.4l-1.8-1.8 c-1.1,2-0.7,4.6,1,6.1c1.4,1.2,3.4,1.5,5.1,0.9l5.7,5.7C16.9,25.6,18,25.6,18.9,24.7S23.6,20.2,22.7,19.3z"/>
             </svg>
          </div>
          {/* Decorative Sparks */}
          <div className="absolute -top-2 -right-4 w-6 h-2 bg-[#6D1B2C] rounded-full transform rotate-45"></div>
          <div className="absolute top-4 -right-8 w-4 h-1.5 bg-[#6D1B2C] rounded-full transform rotate-[60deg]"></div>
        </div>
        <h1 className="text-[34px] font-black text-[#6D1B2C] tracking-tight mb-0.5">
          Mecfinders.in
        </h1>
        <p className="text-gray-500 font-medium text-[15px]">
          Your Ride, Our Responsibility
        </p>
      </div>

      {/* Middle Image */}
      <div className="flex-1 w-full flex items-center justify-center relative my-4 z-0">
        <img src="/img/new/splash_banner.png" alt="Splash Bike" className="w-[120%] max-w-none h-auto object-cover opacity-90 mix-blend-multiply" />
      </div>

      {/* Bottom Section */}
      <div className="w-full px-5 z-10 flex flex-col items-center">
        
        {/* Features Card */}
        <div className="w-full bg-white rounded-[32px] p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 flex justify-between items-center mb-10">
          <div className="flex flex-col items-center gap-1.5 w-1/4">
            <div className="w-10 h-10 rounded-full bg-[#FFF0F2] flex items-center justify-center text-[#6D1B2C]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </div>
            <p className="text-[10px] font-black text-[#131F33] text-center leading-tight">Verified<br/><span className="text-gray-400 font-medium">Mechanics</span></p>
          </div>
          <div className="w-[1px] h-10 bg-gray-100"></div>
          <div className="flex flex-col items-center gap-1.5 w-1/4">
            <div className="w-10 h-10 rounded-full bg-[#F5F3FF] flex items-center justify-center text-[#4C1D95]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <p className="text-[10px] font-black text-[#131F33] text-center leading-tight">Genuine<br/><span className="text-gray-400 font-medium">Parts</span></p>
          </div>
          <div className="w-[1px] h-10 bg-gray-100"></div>
          <div className="flex flex-col items-center gap-1.5 w-1/4">
            <div className="w-10 h-10 rounded-full bg-[#FFF3E0] flex items-center justify-center text-[#E65100]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </div>
            <p className="text-[10px] font-black text-[#131F33] text-center leading-tight">Service<br/><span className="text-gray-400 font-medium">at Home</span></p>
          </div>
          <div className="w-[1px] h-10 bg-gray-100"></div>
          <div className="flex flex-col items-center gap-1.5 w-1/4">
            <div className="w-10 h-10 rounded-full bg-[#FCE4EC] flex items-center justify-center text-[#880E4F]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
            <p className="text-[10px] font-black text-[#131F33] text-center leading-tight">24/7<br/><span className="text-gray-400 font-medium">Support</span></p>
          </div>
        </div>

        {/* Loader */}
        <div className="flex flex-col items-center">
           <div className="w-7 h-7 border-[3px] border-gray-200 border-t-[#6D1B2C] rounded-full animate-spin mb-3"></div>
           <p className="text-[12px] font-bold text-gray-400">Getting things ready...</p>
        </div>
      </div>
    </div>
  );
}
