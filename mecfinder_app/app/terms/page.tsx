"use client";

import { useRouter } from 'next/navigation';

export default function TermsScreen() {
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
        <h1 className="text-xl font-bold text-gray-900">Terms of Service</h1>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="prose text-gray-600">
          <p className="mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          <h2 className="text-lg font-bold text-gray-900 mb-2">1. Agreement to Terms</h2>
          <p className="mb-4">By accessing or using MecFinders, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
          
          <h2 className="text-lg font-bold text-gray-900 mb-2">2. Use License</h2>
          <p className="mb-4">Permission is granted to temporarily download one copy of the materials (information or software) on MecFinders' app for personal, non-commercial transitory viewing only.</p>
          
          <h2 className="text-lg font-bold text-gray-900 mb-2">3. Disclaimer</h2>
          <p className="mb-4">The materials on MecFinders' app are provided on an 'as is' basis. MecFinders makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability.</p>
        </div>
      </div>
    </div>
  );
}

