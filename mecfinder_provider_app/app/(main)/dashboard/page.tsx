'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  MapPin, Clock, TrendingUp, ChevronRight, Check, X, User as UserIcon, Briefcase, Wallet as WalletIcon, Zap, Calendar, Bell,
} from 'lucide-react';
import { mechanicApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMechanicLive } from '@/lib/useMechanicLive';

const ACTIVE_STATUSES = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED', 'READY_FOR_BILLING', 'PAYMENT_PENDING'];

export default function DashboardScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { unread } = useNotifications();

  const [isOnline, setIsOnline] = useState<boolean>(Boolean((profile as any)?.isOnline));
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setIsOnline(Boolean((profile as any)?.isOnline));
  }, [profile]);

  // tick for request countdown timers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: wallet } = useSWR('mechanic/wallet', () => mechanicApi.getWallet());
  const { data: requests, mutate: mutateRequests } = useSWR(
    'mechanic/requests',
    () => mechanicApi.listRequests(),
    { refreshInterval: 15000 }
  );
  const { data: bookingsResp, mutate: mutateBookings } = useSWR(
    'mechanic/bookings',
    () => mechanicApi.listBookings({ limit: 50 }),
    { refreshInterval: 20000 }
  );

  useMechanicLive(
    () => mutateRequests(),
    () => mutateBookings()
  );

  const activeBookings = (bookingsResp?.data || []).filter((b: any) => ACTIVE_STATUSES.includes(b.status));

  const toggleOnline = async () => {
    if (togglingOnline) return;
    const next = !isOnline;
    setTogglingOnline(true);
    setIsOnline(next); // optimistic
    try {
      await mechanicApi.setAvailability(next);
      if (next) mutateRequests();
    } catch {
      setIsOnline(!next); // revert
    } finally {
      setTogglingOnline(false);
    }
  };

  const accept = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      await mechanicApi.acceptRequest(bookingId);
      await Promise.all([mutateRequests(), mutateBookings()]);
      router.push(`/job?id=${bookingId}`);
    } catch {
      mutateRequests();
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      await mechanicApi.rejectRequest(bookingId);
      await mutateRequests();
    } finally {
      setBusyId(null);
    }
  };

  const displayName = profile?.name || 'Partner';
  const list = requests || [];

  return (
    <div className="min-h-full bg-cream pb-6">
      {/* Top bar */}
      <div className="px-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-none text-primary">Mecfinders.in</h1>
            <p className="mt-1 text-sm text-ink/50">Your Ride, Our Responsibility</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/wallet')} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm">
              <WalletIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-ink">₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}</span>
            </button>
            <button onClick={() => router.push('/notifications')} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm" aria-label="Notifications">
              <Bell className="h-5 w-5 text-primary" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button onClick={() => router.push('/profile')} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-ink text-white">
              {profile?.profileImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Welcome */}
      <div className="relative mt-5 px-5">
        <div className="relative flex items-center justify-between overflow-hidden">
          <div className="relative z-10">
            <p className="text-lg text-ink/70">Welcome back,</p>
            <h2 className="text-3xl font-extrabold text-primary">{displayName} <span className="align-middle">👋</span></h2>
            <p className="mt-1 text-sm text-ink/50">Keep up the great work!</p>
          </div>
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary-tint" />
            <span className="relative text-6xl animate-floaty">🏍️</span>
          </div>
        </div>
      </div>

      {/* Online toggle */}
      <div className="mt-5 px-5">
        <div className="flex items-center justify-between rounded-2xl bg-primary-tint px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className={`relative flex h-3.5 w-3.5 ${isOnline ? '' : 'opacity-40'}`}>
              {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />}
              <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
            </span>
            <div>
              <p className="font-bold text-ink">{isOnline ? 'You are Online' : 'You are Offline'}</p>
              <p className="text-xs text-ink/55">{isOnline ? 'Receiving new service requests' : 'Go online to get requests'}</p>
            </div>
          </div>
          <button onClick={toggleOnline} disabled={togglingOnline} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isOnline ? 'bg-primary' : 'bg-gray-300'}`} aria-label="Toggle online status">
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint"><TrendingUp className="h-5 w-5 text-primary" /></div>
          <p className="text-xs font-medium text-ink/55">Wallet Balance</p>
          <p className="mt-0.5 text-2xl font-extrabold text-ink">₹{(wallet?.balance ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint"><Briefcase className="h-5 w-5 text-primary" /></div>
          <p className="text-xs font-medium text-ink/55">Active Jobs</p>
          <p className="mt-0.5 text-2xl font-extrabold text-ink">{activeBookings.length}</p>
        </div>
      </div>

      {/* New Requests */}
      <div className="mt-7 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xl font-extrabold text-ink">New Requests ({list.length})</h3>
        </div>

        {isOnline && list.length > 0 ? (
          <div className="space-y-4">
            {list.map((req: any) => {
              const b = req.booking;
              const original = (b.services || []).find((s: any) => s.kind === 'ORIGINAL') || b.services?.[0];
              const price = original?.priceSnapshot?.totalPrice;
              const secondsLeft = Math.max(0, Math.round((new Date(req.expiresAt).getTime() - now) / 1000));
              const isInstant = b.bookingType === 'INSTANT';
              return (
                <div key={req.requestId} className="rounded-3xl bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isInstant ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {isInstant ? <><Zap className="h-3 w-3" /> INSTANT</> : <><Calendar className="h-3 w-3" /> SCHEDULED</>}
                    </span>
                    {isInstant && (
                      <span className={`text-sm font-bold ${secondsLeft <= 10 ? 'text-red-600' : 'text-ink/60'}`}>{secondsLeft}s</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-[110px] w-[100px] shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-5xl">🔧</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-ink truncate">{original?.name || 'Service'}</h4>
                        {price != null && <span className="text-lg font-extrabold text-green-600">₹{price}</span>}
                      </div>
                      <div className="mt-1 space-y-1">
                        <p className="flex items-center gap-1.5 text-[13px] text-ink/60"><UserIcon className="h-3.5 w-3.5 text-ink/40" /> {b.customer?.name || 'Customer'}</p>
                        <p className="flex items-center gap-1.5 text-[13px] text-ink/60"><MapPin className="h-3.5 w-3.5 shrink-0 text-ink/40" /><span className="truncate">{[b.serviceLocation?.addressLine1, b.serviceLocation?.city].filter(Boolean).join(', ')}</span></p>
                        {!isInstant && b.scheduledAt && (
                          <p className="flex items-center gap-1.5 text-[13px] text-ink/60"><Clock className="h-3.5 w-3.5 text-ink/40" /> {new Date(b.scheduledAt).toLocaleString()}</p>
                        )}
                        <p className="flex items-center gap-1.5 text-[13px] text-ink/60"><span className="text-ink/40">🚗</span> {[b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(' ')} {b.vehicle?.registrationNumber ? `· ${b.vehicle.registrationNumber}` : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button disabled={busyId === b._id} onClick={() => reject(b._id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2.5 font-semibold text-ink/70 active:bg-gray-200 disabled:opacity-50"><X className="h-4 w-4" /> Reject</button>
                    <button disabled={busyId === b._id} onClick={() => accept(b._id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 font-semibold text-white shadow-sm active:bg-primary-dark disabled:opacity-50"><Check className="h-4 w-4" /> Accept</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary"><Clock className="h-8 w-8" /></div>
            <h4 className="mb-1 font-bold text-ink">{isOnline ? 'No new requests' : 'You are offline'}</h4>
            <p className="text-sm text-ink/55">{isOnline ? 'New service requests will appear here.' : 'Go online to start receiving requests near you.'}</p>
          </div>
        )}
      </div>

      {/* Active Jobs */}
      {activeBookings.length > 0 && (
        <div className="mt-7 px-5">
          <h3 className="mb-3 text-xl font-extrabold text-ink">Active Jobs</h3>
          <div className="space-y-3">
            {activeBookings.map((b: any) => {
              const original = (b.services || []).find((s: any) => s.kind === 'ORIGINAL') || b.services?.[0];
              return (
                <button key={b._id} onClick={() => router.push(`/job?id=${b._id}`)} className="w-full flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-2xl">🔧</div>
                    <div>
                      <h4 className="font-bold text-ink">{original?.name || 'Service'}</h4>
                      <p className="text-sm text-ink/50">{b.customer?.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-ink/55">{b.status.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint text-primary"><ChevronRight className="h-5 w-5" /></span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
