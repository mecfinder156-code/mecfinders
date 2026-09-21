'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Mail, Fingerprint, Calendar, User as UserIcon } from 'lucide-react';

export default function BasicInfoScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 ">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center sticky top-0 z-10">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700 " />
        </button>
        <h1 className="text-xl font-bold text-gray-900 ml-2">Basic Information</h1>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-start">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 mr-4">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</p>
              <p className="text-base font-medium text-gray-900 break-all">{profile.email}</p>
            </div>
          </div>

          <div className="p-4 border-b border-gray-50 flex items-start">
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600 mr-4">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account ID</p>
              <p className="text-sm font-medium text-gray-900 break-all font-mono">{profile.firebaseUid}</p>
            </div>
          </div>

          <div className="p-4 border-b border-gray-50 flex items-start">
            <div className="p-3 rounded-xl bg-green-50 text-green-600 mr-4">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Age</p>
              <p className="text-base font-medium text-gray-900 ">{profile.age || 'Not provided'} years</p>
            </div>
          </div>

          <div className="p-4 flex items-start">
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600 mr-4">
              <UserIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Gender</p>
              <p className="text-base font-medium text-gray-900 capitalize">{profile.gender || 'Not provided'}</p>
            </div>
          </div>
        </div>
        
        <p className="text-xs text-center text-gray-400 mt-6 px-4">
          Basic information cannot be changed from the app. Please contact support if you need to update these details.
        </p>
      </div>
    </div>
  );
}

