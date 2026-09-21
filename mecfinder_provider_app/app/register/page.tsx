'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function Register() {
  const { user, refreshProfile, profile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [photo, setPhoto] = useState(''); // Base64
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profile) {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  const handleCapture = async () => {
    try {
      // Explicitly check permissions first
      const permissions = await Camera.checkPermissions();
      if (permissions.camera !== 'granted') {
        const requested = await Camera.requestPermissions({ permissions: ['camera'] });
        if (requested.camera !== 'granted') {
          setError('Camera permission is strictly required to capture a live photo.');
          return;
        }
      }

      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera, // Force device camera
      });
      if (image.base64String) {
        setPhoto(`data:image/${image.format};base64,${image.base64String}`);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Not authenticated with Firebase.');
      return;
    }
    if (!photo) {
      setError('Live photo capture is required for mechanics.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/mobile/register', {
        firebaseUid: user.uid,
        phone: user.phoneNumber,
        role: 'mechanic',
        name,
        email,
        age,
        gender,
        profileImage: photo,
      });

      // Save the access token for authenticated requests
      const responseData = response.data.data;
      if (responseData?.accessToken) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: 'accessToken', value: responseData.accessToken });
      }

      await refreshProfile();
      router.replace('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

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

      <div className="flex-1 px-6 pt-6 pb-8 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Mechanic Profile</h1>
          <p className="text-gray-500">
            Complete your profile to start accepting service requests.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 mb-8">
            <Input 
              label="Phone Number"
              value={user.phoneNumber || ''}
              disabled
              className="bg-gray-100 text-gray-500"
            />
            
            <Input 
              label="Full Name"
              placeholder="Alex Fixit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            
            <Input 
              label="Email Address"
              type="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <div className="flex gap-4">
              <div className="flex-1">
                <Input 
                  label="Age"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="28"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Gender</label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium text-gray-900"
                >
                  <option value="" disabled>Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Photo Capture</label>
              {photo ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Live capture" className="w-24 h-24 object-cover rounded-full border-4 border-primary/20 shadow-sm" />
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="text-primary text-sm font-semibold hover:underline"
                  >
                    Retake Photo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCapture}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-primary/50 hover:text-primary transition-all"
                >
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium">Take Photo</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-4">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center font-medium">
                {error}
              </div>
            )}
            <Button
              type="submit"
              fullWidth
              size="lg"
              isLoading={loading}
              disabled={!photo || !name.trim() || !email.trim() || !age || !gender}
            >
              Complete Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
