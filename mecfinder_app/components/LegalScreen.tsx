"use client";

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { legalApi } from '@/lib/api';

/**
 * Renders an admin-editable legal document (privacy / terms). Content comes from
 * the backend (audience = customer) so admins can update it from the panel;
 * paragraphs are split on blank lines. Falls back to a loading state.
 */
export default function LegalScreen({
  type,
  fallbackTitle,
  subtitle,
}: {
  type: 'privacy' | 'terms';
  fallbackTitle: string;
  subtitle: string;
}) {
  const router = useRouter();
  const { data: doc, isLoading } = useSWR(`legal/${type}`, () => legalApi.get(type), {
    revalidateOnFocus: false,
  });

  const title = doc?.title || fallbackTitle;
  const paragraphs = String(doc?.content || '')
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative overflow-hidden pb-24">
      <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none">
        <img src="/img/new/map_upper.png" alt="City Background" className="w-full h-auto object-cover opacity-80 mix-blend-multiply" />
      </div>
      <div className="flex-1 flex flex-col relative z-10 px-6 pt-14 pb-10">
        <div className="relative mb-6">
          <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33] hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 pr-2">
            <h1 className="text-[26px] font-black text-[#131F33] tracking-tight mb-0.5 leading-tight">{title}</h1>
            <p className="text-[13px] text-gray-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_25px_rgb(0,0,0,0.03)] border border-gray-50 z-10 py-7 space-y-4">
          {isLoading && paragraphs.length === 0 ? (
            <p className="text-gray-400 font-medium text-sm">Loading…</p>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="text-gray-600 font-medium text-sm leading-relaxed whitespace-pre-line">{p}</p>
            ))
          )}
          {doc?.updatedAt && (
            <p className="pt-2 text-[11px] text-gray-400">Last updated {new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          )}
        </div>
      </div>
    </div>
  );
}
