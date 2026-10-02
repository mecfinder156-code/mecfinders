"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Image from 'next/image';
import { useAuth, Profile } from '../../contexts/AuthContext';
import { api } from '../../lib/api';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export default function RegistrationScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    avatar: '👨',
  });

  const avatars = ['👨', '👩', '🧑', '🧔', '👱‍♂️', '👱‍♀️'];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    setGlobalError('');

    try {
      // Identity comes from the verified Firebase token, not client-sent fields.
      const { token: idToken } = await FirebaseAuthentication.getIdToken();
      const payload: any = {
        idToken,
        role: 'customer',
        name: formData.fullName,
        profileImage: formData.avatar, // Backend expects profileImage
      };

      if (formData.email && formData.email.trim() !== '') {
        payload.email = formData.email.trim();
      }

      await api.post('/auth/mobile/register', payload);

      await refreshProfile();
      router.replace('/permissions');
    } catch (err: any) {
      console.error(err);
      setGlobalError(err.response?.data?.message || err.message || 'Failed to connect to server');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-2">
        <button 
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-sm font-medium text-gray-400">Step 2 of 2</div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Complete Profile</h1>
          <p className="text-gray-500">
            Provide your details to get started with MecFinders
          </p>
        </div>

        <form onSubmit={handleRegister} className="flex-1 flex flex-col">
          
          {/* Avatar Picker */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 text-center">Choose an Avatar</label>
            <div className="flex justify-center gap-4 flex-wrap">
              {avatars.map(avatar => (
                <button
                  key={avatar}
                  type="button"
                  onClick={() => setFormData({...formData, avatar})}
                  className={`text-4xl p-2 rounded-full transition-all ${formData.avatar === avatar ? 'bg-blue-100 border-2 border-blue-500 scale-110 shadow-sm' : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'}`}
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 mb-8">
            <Input 
              label="Full Name"
              placeholder="John Doe"
              value={formData.fullName}
              onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              required
            />
            
            <Input 
              label="Email Address (Optional)"
              type="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />

            <Input 
              label="Phone Number"
              value={user?.phoneNumber || ''}
              disabled
              className="bg-gray-100 text-gray-500"
            />
          </div>

          <div className="mt-auto pt-6">
            {globalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center">
                {globalError}
              </div>
            )}
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
              disabled={!formData.fullName.trim()}
            >
              Create Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

