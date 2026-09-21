'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ChevronLeft, Bell } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { useNotifications } from '@/contexts/NotificationContext';

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

export default function NotificationsScreen() {
  const router = useRouter();
  const { refreshUnread, setUnread } = useNotifications();
  const { data, isLoading, mutate } = useSWR('mechanic/notifications', () =>
    notificationsApi.getAll({ limit: 40 })
  );

  const items: NotificationItem[] = data?.notifications || [];

  // Opening the screen is a good moment to sync the badge with the server.
  useEffect(() => {
    if (data && typeof data.unread === 'number') setUnread(data.unread);
  }, [data, setUnread]);

  const handleOpen = async (n: NotificationItem) => {
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
      router.push(`/job?id=${bookingId}`);
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
    <div className="flex min-h-screen flex-col bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/[0.04] bg-white px-4 py-4 shadow-sm">
        <button
          onClick={() => router.back()}
          className="-ml-2 rounded-full p-2 transition-colors active:bg-gray-100"
        >
          <ChevronLeft className="h-6 w-6 text-ink" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-ink">Notifications</h1>
          <p className="text-xs text-ink/50">Stay on top of your jobs</p>
        </div>
        {hasUnread && (
          <button
            onClick={handleMarkAll}
            className="rounded-full bg-primary-tint px-3 py-1.5 text-[11px] font-bold text-primary"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 px-4 pt-4">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
              <Bell className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-extrabold text-ink">No notifications yet</h3>
            <p className="mt-1 max-w-[240px] text-sm font-medium text-ink/50">
              Updates about your jobs and payouts will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => handleOpen(n)}
                className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-transform active:scale-[0.99] ${
                  n.readAt ? 'border-gray-100 bg-white' : 'border-primary/15 bg-primary-tint/40'
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-xl">
                  {TYPE_ICON[n.type] || '🔔'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold leading-tight text-ink">{n.title}</h3>
                    {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs font-medium leading-snug text-ink/55">{n.body}</p>
                  <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-ink/35">
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
