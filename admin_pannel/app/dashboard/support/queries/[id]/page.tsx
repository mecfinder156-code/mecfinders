'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, supportApi, type SupportQuery } from '@/lib/api';
import { ChevronLeft } from 'lucide-react';

const STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  ANSWERED: 'bg-blue-100 text-blue-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

function formatDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SupportQueryDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const swrKey = id ? `/admin/support/queries/${id}` : null;
  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher);
  const query: SupportQuery | undefined = data?.data?.query;

  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message;

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await supportApi.replyQuery(id, reply.trim());
      setReply('');
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (status: 'OPEN' | 'ANSWERED' | 'CLOSED') => {
    setStatusLoading(true);
    try {
      await supportApi.setQueryStatus(id, status);
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (errorMessage || !query) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/support/queries"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Support Queries
        </Link>
        <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          {errorMessage || 'Query not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/dashboard/support/queries"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Support Queries
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{query.subject}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {query.name || 'Unknown'} · {query.role === 'mechanic' ? 'Provider' : 'Customer'}
              {query.phone ? ` · ${query.phone}` : ''}
              {query.email ? ` · ${query.email}` : ''}
            </p>
            <p className="text-xs text-gray-400 mt-1">Received {formatDate(query.createdAt)}</p>
          </div>
          <span
            className={`shrink-0 inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
              STATUS_CLS[query.status] || 'bg-gray-100 text-gray-600'
            }`}
          >
            {query.status}
          </span>
        </div>

        {query.bookingId && (
          <div className="mt-3">
            <Link
              href={`/dashboard/bookings/${query.bookingId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View related booking →
            </Link>
          </div>
        )}

        {/* Status controls */}
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <span className="text-sm font-medium text-gray-600 mr-1">Set status:</span>
          {(['OPEN', 'ANSWERED', 'CLOSED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              disabled={statusLoading || query.status === s}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                query.status === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation thread */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Conversation</h2>
        <div className="space-y-3">
          {query.replies && query.replies.length > 0 ? (
            query.replies.map((r, idx) => (
              <div
                key={r._id || idx}
                className={`flex ${r.author === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    r.author === 'admin'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{r.message}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      r.author === 'admin' ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {r.author === 'admin' ? 'Support' : query.name || 'User'} ·{' '}
                    {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">{query.message}</p>
          )}
        </div>

        {/* Reply composer */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reply</label>
          <textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your response to the user..."
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleReply}
              disabled={sending || !reply.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
