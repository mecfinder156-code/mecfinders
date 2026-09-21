"use client";

import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useEffect } from 'react';
import { notificationsApi } from '@/lib/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBackHandler } from '@/lib/useBackHandler';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  bookingId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

// Emoji per notification type — keeps the list scannable.
const TYPE_ICON: Record<string, string> = {
  MECHANIC_ASSIGNED: '🔧',
  MECHANIC_ARRIVED: '📍',
  WORK_STARTED: '🛠️',
  READY_FOR_BILLING: '🧾',
  BOOKING_COMPLETED: '🎉',
  BOOKING_CANCELLED: '❌',
  BOOKING_EXPIRED: '⏳',
  EARNING_ADDED: '💰',
  SUPPORT_REPLY: '💬',
  NEW_REQUEST: '🔔',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { refreshUnread, setUnread } = useNotifications();
  const { data, isLoading, mutate } = useSWR('/mobile/notifications', () =>
    notificationsApi.getAll({ limit: 40 })
  );

  const items: NotificationItem[] = data?.notifications || [];

  useBackHandler(true, () => router.back());

  // Opening the screen is a good moment to sync the badge with the server.
  useEffect(() => {
    if (data && typeof data.unread === 'number') setUnread(data.unread);
  }, [data, setUnread]);

  const handleOpen = async (n: NotificationItem) => {
    // Mark read optimistically, then deep-link to the booking if present.
    if (!n.readAt) {
      try {
        await notificationsApi.markRead(n._id);
        mutate();
        refreshUnread();
      } catch {
        /* ignore */
      }
    }
    const bookingId = n.bookingId || n.data?.bookingId;
    if (bookingId) {
      router.push(`/booking?id=${bookingId}`);
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead();
      setUnread(0);
      mutate();
    } catch {
      /* ignore */
    }
  };

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] pb-10 font-sans">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#F9F5F0] to-white px-5 pt-14 pb-5 rounded-b-[28px] border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-[#131F33] shadow-sm"
          >
            <svg className="w-5 h-5 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-[24px] font-black text-[#131F33] leading-tight tracking-tight">Notifications</h1>
            <p className="text-[12px] text-gray-500 font-medium">Stay updated on your bookings</p>
          </div>
          {hasUnread && (
            <button
              onClick={handleMarkAll}
              className="text-[11px] font-bold text-[#6D1B2C] bg-[#FBE7EB] px-3 py-1.5 rounded-full"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-4 flex-1">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6D1B2C]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4 opacity-50">🔔</div>
            <h3 className="text-lg font-black text-[#131F33]">No notifications yet</h3>
            <p className="text-sm text-gray-500 font-medium mt-1 max-w-[240px]">
              Updates about your bookings will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => handleOpen(n)}
                className={`w-full text-left rounded-2xl p-3.5 border flex gap-3 items-start active:scale-[0.99] transition-transform ${
                  n.readAt ? 'bg-white border-gray-100' : 'bg-[#FBE7EB]/40 border-[#F5D9DF]'
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#FBE7EB] flex items-center justify-center text-xl shrink-0">
                  {TYPE_ICON[n.type] || '🔔'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[14px] font-bold text-[#131F33] leading-tight">{n.title}</h3>
                    {!n.readAt && <span className="mt-1 w-2 h-2 rounded-full bg-[#6D1B2C] shrink-0" />}
                  </div>
                  <p className="text-[12px] text-gray-500 font-medium mt-0.5 leading-snug">{n.body}</p>
                  <p className="text-[10px] text-gray-400 font-bold mt-1.5 uppercase tracking-wide">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
