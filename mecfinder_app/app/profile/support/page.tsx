"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
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

export default function SupportPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'faqs' | 'queries'>('faqs');
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const { data: faqData } = useSWR('/mobile/support/faqs', () => supportApi.getFaqs());
  const groups: FaqGroup[] = faqData?.faqs || [];

  const { data: queriesData, mutate: mutateQueries } = useSWR('/mobile/support/queries', () =>
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
    <div className="min-h-screen bg-[#FDFDFD] font-sans flex flex-col relative pb-28">
      <div className="flex-1 flex flex-col relative z-10 px-5 pt-14">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-[#131F33]"
          >
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-[24px] font-black text-[#131F33] tracking-tight leading-tight">Help &amp; Support</h1>
            <p className="text-[12px] text-gray-500 font-medium">We&apos;re here to help you</p>
          </div>
        </div>

        {sent && (
          <div className="mb-4 bg-green-50 border border-green-100 text-green-700 text-[13px] font-bold rounded-2xl px-4 py-3">
            ✅ Your query has been submitted. We&apos;ll get back to you soon.
          </div>
        )}

        {/* Tabs */}
        <div className="bg-gray-100 p-1 rounded-2xl flex relative mb-5">
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
            style={{ left: tab === 'faqs' ? '4px' : 'calc(50%)' }}
          />
          <button
            onClick={() => setTab('faqs')}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${tab === 'faqs' ? 'text-[#131F33]' : 'text-gray-500'}`}
          >
            FAQs
          </button>
          <button
            onClick={() => setTab('queries')}
            className={`flex-1 py-2.5 text-sm font-bold z-10 transition-colors ${tab === 'queries' ? 'text-[#131F33]' : 'text-gray-500'}`}
          >
            My Queries
          </button>
        </div>

        {tab === 'faqs' ? (
          <div className="space-y-5">
            {groups.length === 0 ? (
              <div className="bg-white rounded-[24px] p-8 text-center border border-gray-50 shadow-sm">
                <p className="text-gray-500 font-medium text-sm">No FAQs available right now.</p>
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.category}>
                  <h2 className="text-[12px] font-black text-gray-400 uppercase tracking-wide mb-2 px-1">
                    {group.category}
                  </h2>
                  <div className="space-y-2">
                    {group.items.map((item) => {
                      const isOpen = openFaq === item._id;
                      return (
                        <div
                          key={item._id}
                          className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] overflow-hidden"
                        >
                          <button
                            onClick={() => setOpenFaq(isOpen ? null : item._id)}
                            className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3"
                          >
                            <span className="text-[14px] font-bold text-[#131F33]">{item.question}</span>
                            <svg
                              className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isOpen && (
                            <div className="px-4 pb-4 -mt-1">
                              <p className="text-[13px] text-gray-500 font-medium leading-relaxed whitespace-pre-wrap">
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
              <div className="bg-white rounded-[24px] p-8 text-center border border-gray-50 shadow-sm">
                <div className="text-4xl mb-3 opacity-50">💬</div>
                <p className="text-gray-500 font-medium text-sm">
                  You haven&apos;t raised any queries yet.
                </p>
              </div>
            ) : (
              myQueries.map((q) => {
                const lastAdminReply = [...(q.replies || [])].reverse().find((r) => r.author === 'admin');
                return (
                  <div
                    key={q._id}
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-[14px] font-bold text-[#131F33]">{q.subject}</h3>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[q.status]}`}
                      >
                        {q.status}
                      </span>
                    </div>
                    {lastAdminReply ? (
                      <p className="text-[12px] text-gray-600 font-medium leading-snug bg-gray-50 rounded-xl p-2.5 mt-2">
                        <span className="font-bold text-[#6D1B2C]">Support: </span>
                        {lastAdminReply.message}
                      </p>
                    ) : (
                      <p className="text-[12px] text-gray-400 font-medium mt-1">Awaiting a response...</p>
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
            className="w-full bg-[#6D1B2C] text-white rounded-[16px] h-14 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-[0_8px_20px_rgb(109,27,44,0.2)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Ask a Question
          </button>
        </div>
      ) : (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div
            className="w-full bg-white rounded-t-[28px] p-5 pb-8"
            style={{ animation: 'sheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
            </div>
            <h2 className="text-lg font-black text-[#131F33] mb-4">Ask a Question</h2>
            {error && (
              <p className="text-[12px] text-red-600 font-semibold mb-3 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-bold text-gray-600 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Refund not received"
                  maxLength={150}
                  className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 font-semibold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-gray-600 mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  maxLength={2000}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-semibold text-[14px] text-[#131F33] focus:outline-none focus:border-[#6D1B2C] resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-xl h-12 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !subject.trim() || !message.trim()}
                className="flex-1 bg-[#6D1B2C] text-white rounded-xl h-12 font-bold text-sm disabled:opacity-40"
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
