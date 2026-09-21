'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-screen bg-white ">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700 " />
        </button>
        <h1 className="text-xl font-bold text-gray-900 ml-2">Terms & Conditions</h1>
      </div>

      <div className="p-6 pb-12 overflow-y-auto prose prose-sm prose-gray">
        <p className="text-gray-500 mb-6">Last updated: September 20, 2026</p>
        
        <h3 className="font-bold text-gray-800 text-lg mb-2 mt-6">1. Acceptance of Terms</h3>
        <p className="text-gray-600 mb-4 leading-relaxed">
          By accessing and using the MecFinders Provider App, you accept and agree to be bound by the terms and provision of this agreement.
        </p>

        <h3 className="font-bold text-gray-800 text-lg mb-2 mt-6">2. Service Provision</h3>
        <p className="text-gray-600 mb-4 leading-relaxed">
          Providers must ensure that all services rendered through the platform meet professional industry standards. Mechanics are independent contractors, not employees of MecFinders.
        </p>

        <h3 className="font-bold text-gray-800 text-lg mb-2 mt-6">3. Verification & Documents</h3>
        <p className="text-gray-600 mb-4 leading-relaxed">
          You agree to provide accurate and up-to-date identity documents. Any falsification of documents will result in immediate permanent termination of your account.
        </p>
        
        <h3 className="font-bold text-gray-800 text-lg mb-2 mt-6">4. Payments</h3>
        <p className="text-gray-600 mb-4 leading-relaxed">
          Payments are processed securely. MecFinders reserves the right to hold payouts in cases of disputed service quality until the dispute is resolved.
        </p>
      </div>
    </div>
  );
}

