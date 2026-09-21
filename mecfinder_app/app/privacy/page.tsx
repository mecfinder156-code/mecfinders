"use client";

import { useRouter } from 'next/navigation';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center p-6 border-b border-gray-100">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors mr-4"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="prose text-gray-600">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">1. Information We Collect</h2>
          <p className="mb-4">We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us.</p>
          
          <h2 className="text-lg font-bold text-gray-900 mb-2">2. How We Use Information</h2>
          <p className="mb-4">We may use the information we collect about you to provide, maintain, and improve our services, including to facilitate payments, send receipts, provide products and services you request.</p>
          
          <h2 className="text-lg font-bold text-gray-900 mb-2">3. Sharing of Information</h2>
          <p className="mb-4">We may share the information we collect about you with our mechanics in order to provide the services you request, including your name, vehicle details, and service location.</p>
        </div>
      </div>
    </div>
  );
}

