'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { ArrowLeft, Camera as CameraIcon, RotateCcw } from 'lucide-react';
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
        source: CameraSource.Camera,
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
      // Identity comes from the verified Firebase token, not client-sent fields.
      const { token: idToken } = await FirebaseAuthentication.getIdToken();
      const response = await api.post('/auth/mobile/register', {
        idToken,
        role: 'mechanic',
        name,
        email,
        age,
        gender,
        profileImage: photo,
      });

      const responseData = response.data.data;
      if (responseData?.accessToken) {
        const { Preferences } = await import('@capacitor/preferences');
        await Preferences.set({ key: 'accessToken', value: responseData.accessToken });
        if (responseData.refreshToken) {
          await Preferences.set({ key: 'refreshToken', value: responseData.refreshToken });
        }
      }

      await refreshProfile();
      router.replace('/permissions');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-cream">
      <div className="pointer-events-none absolute -top-28 -right-24 h-72 w-72 rounded-full bg-primary-tint blur-2xl" />

      {/* Header + progress */}
      <div className="relative z-10 px-6 pt-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-sm active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-ink/45">Step 2 of 2</span>
        </div>
        <div className="mt-4 flex gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-primary" />
          <span className="h-1.5 flex-1 rounded-full bg-primary" />
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-8 pt-8">
        <div className="mb-7">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-ink">Set up your profile</h1>
          <p className="mt-2 text-[15px] font-medium text-ink/55">
            Complete your mechanic profile to start accepting service requests.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Live photo — hero of the form */}
          <div className="mb-7 flex flex-col items-center">
            {photo ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Live capture" className="h-28 w-28 rounded-full border-4 border-primary/15 object-cover shadow-md" />
                <button
                  type="button"
                  onClick={handleCapture}
                  className="flex items-center gap-1.5 text-sm font-bold text-primary active:opacity-70"
                >
                  <RotateCcw className="h-4 w-4" /> Retake photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCapture}
                className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-full border-2 border-dashed border-primary/25 bg-white text-primary/60 transition-all active:scale-95 hover:border-primary/50 hover:text-primary"
              >
                <CameraIcon className="h-7 w-7" strokeWidth={2} />
                <span className="text-[11px] font-bold">Live photo</span>
              </button>
            )}
          </div>

          <div className="space-y-5">
            <Input label="Phone Number" value={user.phoneNumber || ''} disabled className="opacity-60" />
            <Input label="Full Name" placeholder="Alex Fixit" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email Address" type="email" placeholder="alex@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <div className="flex gap-4">
              <div className="flex-1">
                <Input label="Age" type="number" min="18" max="100" placeholder="28" value={age} onChange={(e) => setAge(e.target.value)} required />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink/45">Gender</label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="h-[54px] w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-base font-medium text-ink outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/15"
                >
                  <option value="" disabled>Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-7">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600">
                {error}
              </div>
            )}
            <Button type="submit" fullWidth size="lg" isLoading={loading} disabled={!photo || !name.trim() || !email.trim() || !age || !gender}>
              Complete Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
