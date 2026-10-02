'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, ChevronDown, MessageCircle, Plus, X, CheckCircle2 } from 'lucide-react';
import { supportApi } from '@/lib/api';

interface FaqItem {
  _id: string;
  question: string;
  answer: string;
}
interface FaqGroup {
  category: string;
  items: FaqItem[];
}
interface MyQuery {
  _id: string;
  subject: string;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  replies?: { author: string; message: string }[];
}

const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  ANSWERED: 'bg-green-50 text-green-700 border-green-100',
  CLOSED: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function HelpScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'faqs' | 'queries'>('faqs');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const { data: faqData } = useSWR('mechanic/support/faqs', () => supportApi.getFaqs());
  const groups: FaqGroup[] = faqData?.faqs || [];

  const { data: queriesData, mutate: mutateQueries } = useSWR('mechanic/support/queries', () =>
    supportApi.getQueries({ limit: 20 })
  );
  const myQueries: MyQuery[] = queriesData?.data || [];

  // Ask form
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await supportApi.createQuery({ subject: subject.trim(), message: message.trim() });
      setSubject('');
      setMessage('');
      setShowForm(false);
      setSent(true);
      setTab('queries');
      mutateQueries();
      setTimeout(() => setSent(false), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not submit your query. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 transition-colors active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-ink">Help &amp; Support</h1>
          <p className="text-xs text-ink/50">We&apos;re here to help you</p>
        </div>
      </div>

      <div className="px-5 pt-5">
        {sent && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-[13px] font-bold text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Your query has been submitted. We&apos;ll get back to you soon.
          </div>
        )}

        {/* Tabs */}
        <div className="relative mb-5 flex rounded-2xl bg-white p-1 shadow-sm">
          <div
            className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-xl bg-primary-tint transition-all duration-300 ease-out"
            style={{ left: tab === 'faqs' ? '4px' : 'calc(50%)' }}
          />
          <button
            onClick={() => setTab('faqs')}
            className={`z-10 flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'faqs' ? 'text-primary' : 'text-ink/50'}`}
          >
            FAQs
          </button>
          <button
            onClick={() => setTab('queries')}
            className={`z-10 flex-1 py-2.5 text-sm font-bold transition-colors ${tab === 'queries' ? 'text-primary' : 'text-ink/50'}`}
          >
            My Queries
          </button>
        </div>

        {tab === 'faqs' ? (
          <div className="space-y-5">
            {groups.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-ink/55">No FAQs available right now.</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.category}>
                  <h2 className="mb-2 px-1 text-[12px] font-black uppercase tracking-wide text-ink/40">
                    {group.category}
                  </h2>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isOpen = openFaq === item._id;
                      return (
                        <div key={item._id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                          <button
                            onClick={() => setOpenFaq(isOpen ? null : item._id)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                          >
                            <span className="text-sm font-bold text-ink">{item.question}</span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-ink/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                          </button>
                          {isOpen && (
                            <div className="-mt-1 px-4 pb-4">
                              <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-ink/55">
                                {item.answer}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {myQueries.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <div className="mb-3 flex justify-center text-ink/30">
                  <MessageCircle className="h-10 w-10" />
                </div>
                <p className="text-sm font-medium text-ink/55">You haven&apos;t raised any queries yet.</p>
              </div>
            ) : (
              myQueries.map((q) => {
                const lastAdminReply = [...(q.replies || [])].reverse().find((r) => r.author === 'admin');
                return (
                  <div key={q._id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-ink">{q.subject}</h3>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[q.status]}`}
                      >
                        {q.status}
                      </span>
                    </div>
                    {lastAdminReply ? (
                      <p className="mt-2 rounded-xl bg-gray-50 p-2.5 text-xs font-medium leading-snug text-ink/70">
                        <span className="font-bold text-primary">Support: </span>
                        {lastAdminReply.message}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-ink/40">Awaiting a response...</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Ask a question CTA / form */}
      {!showForm ? (
        <div className="fixed bottom-6 left-5 right-5 z-20">
          <button
            onClick={() => {
              setShowForm(true);
              setError('');
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-bold text-white shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" />
            Ask a Question
          </button>
        </div>
      ) : (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div
            className="w-full rounded-t-[28px] bg-white p-5 pb-8"
            style={{ animation: 'sheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-ink">Ask a Question</h2>
              <button onClick={() => setShowForm(false)} className="rounded-full p-1 active:bg-gray-100">
                <X className="h-5 w-5 text-ink/50" />
              </button>
            </div>
            {error && (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">{error}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-ink/60">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Payout not received"
                  maxLength={150}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-[14px] font-semibold text-ink focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12px] font-bold text-ink/60">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] font-semibold text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="h-12 flex-1 rounded-xl bg-gray-100 text-sm font-bold text-ink/70"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !subject.trim() || !message.trim()}
                className="h-12 flex-1 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-40"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }` }} />
        </div>
      )}
    </div>
  );
}
