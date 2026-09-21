'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Wrench } from 'lucide-react';

const SPLASH_MIN_MS = 1900;

export default function Splash() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading || !minElapsed) return;

    if (!user) {
      router.replace('/onboarding');
    } else if (user && !profile) {
      router.replace('/register');
    } else {
      router.replace('/dashboard');
    }
  }, [user, profile, loading, minElapsed, router]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cream px-6">
      {/* Soft decorative glows */}
      <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-primary-tint blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-accent/40 blur-2xl" />

      {/* Brand mark */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="animate-pop-in">
          <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] bg-primary shadow-xl shadow-primary/30">
            {/* gold accent dot */}
            <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-md">
              <span className="text-sm font-extrabold">mF</span>
            </span>
            <Wrench className="h-12 w-12 text-white" strokeWidth={2.2} />
          </div>
        </div>

        <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.15s', opacity: 0 }}>
          <h1 className="text-4xl font-extrabold tracking-tight text-primary">
            MecFinders
          </h1>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="h-px w-6 bg-ink/20" />
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-accent-ink">
              Provider
            </span>
            <span className="h-px w-6 bg-ink/20" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink/55">
            Your Skill, Our Platform
          </p>
        </div>
      </div>

      {/* Loader */}
      <div className="absolute bottom-14 z-10 flex flex-col items-center animate-fade-in" style={{ animationDelay: '0.4s', opacity: 0 }}>
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        <p className="mt-4 text-xs font-medium tracking-wide text-ink/40">
          Getting things ready…
        </p>
      </div>
    </div>
  );
}
