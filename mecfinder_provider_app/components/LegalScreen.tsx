'use client';

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft } from 'lucide-react';
import { legalApi } from '@/lib/api';

/**
 * Admin-editable legal document (privacy / terms) for the provider app. Content
 * is fetched from the backend (audience = provider); paragraphs split on blank
 * lines so admins can edit it from the panel.
 */
export default function LegalScreen({ type, fallbackTitle }: { type: 'privacy' | 'terms'; fallbackTitle: string }) {
  const router = useRouter();
  const { data: doc, isLoading } = useSWR(`legal/${type}`, () => legalApi.get(type), { revalidateOnFocus: false });

  const title = doc?.title || fallbackTitle;
  const paragraphs = String(doc?.content || '')
    .split(/\n{2,}/)
    .map((p: string) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button onClick={() => router.back()} className="-ml-2 rounded-full p-2 transition-colors active:bg-black/[0.05]" aria-label="Back">
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <h1 className="text-xl font-extrabold text-ink">{title}</h1>
      </div>

      <div className="p-5 pb-12">
        {doc?.updatedAt && (
          <p className="mb-5 text-sm font-medium text-ink/45">
            Last updated: {new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-4">
          {isLoading && paragraphs.length === 0 ? (
            <p className="text-[13px] font-medium text-ink/45">Loading…</p>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line text-[13px] font-medium leading-relaxed text-ink/60">{p}</p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
