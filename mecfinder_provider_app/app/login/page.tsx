"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.length < 5) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
      const { verificationId } = await login(formattedPhone);
      router.push(`/otp?verificationId=${encodeURIComponent(verificationId)}&phone=${encodeURIComponent(formattedPhone)}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top Graphic Area */}
      <div className="relative w-full h-72 bg-gray-50 flex items-center justify-center overflow-hidden rounded-b-[40px]">
        <div className="absolute inset-0 bg-primary/10"></div>
        <Image
          src="/img/login_hero.png"
          alt="Login"
          fill
          className="object-cover opacity-80 mix-blend-multiply"
        />
      </div>

      <div className="flex-1 px-6 pt-10 pb-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Welcome Back!</h1>
          <p className="text-gray-500">Sign in to continue to MecFinders</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col">
          <div className="mb-8">
            <div className="flex space-x-3 mb-2">
              {/* Country Code Selector (Static for now) */}
              <div className="w-24">
                <Input 
                  value="+91"
                  readOnly
                  className="text-center font-medium bg-gray-100"
                />
              </div>
              <div className="flex-1">
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  error={error}
                  maxLength={15}
                  className="font-medium"
                />
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4 text-center">
              We will send you a 6-digit one time password to verify your phone number.
            </p>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={isLoading}
            >
              Continue
            </Button>
            
            <div className="mt-6 text-center text-sm text-gray-500">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-primary font-medium hover:underline">Terms of Service</Link> and{' '}
              <Link href="/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

