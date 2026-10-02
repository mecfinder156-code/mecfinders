'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, Mail, Fingerprint, Calendar, User as UserIcon } from 'lucide-react';

export default function BasicInfoScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  if (!profile) return null;

  const rows = [
    { icon: Mail, label: 'Email Address', value: profile.email || 'Not provided', mono: false },
    { icon: Fingerprint, label: 'Account ID', value: profile.firebaseUid, mono: true },
    { icon: Calendar, label: 'Age', value: profile.age ? `${profile.age} years` : 'Not provided', mono: false },
    { icon: UserIcon, label: 'Gender', value: profile.gender || 'Not provided', mono: false, capitalize: true },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 transition-colors active:bg-black/[0.05]"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <h1 className="text-xl font-extrabold text-ink">Basic Information</h1>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className={`flex items-start p-4 ${i !== rows.length - 1 ? 'border-b border-black/[0.05]' : ''}`}>
                <div className="mr-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink/40">{row.label}</p>
                  <p className={`break-all text-[15px] font-semibold text-ink ${row.mono ? 'font-mono text-sm' : ''} ${row.capitalize ? 'capitalize' : ''}`}>
                    {row.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 px-4 text-center text-xs font-medium text-ink/45">
          Basic information cannot be changed from the app. Please contact support if you need to update these details.
        </p>
      </div>
    </div>
  );
}
