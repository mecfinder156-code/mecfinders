'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  MapPin, Clock, TrendingUp, ChevronRight, Check, X, User as UserIcon, Briefcase, Zap, Calendar, Bell, Wrench, Car, AlertCircle,
} from 'lucide-react';
import { mechanicApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useMechanicLive } from '@/lib/useMechanicLive';
import { playRequestBeep, primeAudio } from '@/lib/sound';

const ACTIVE_STATUSES = ['MECHANIC_ASSIGNED', 'MECHANIC_ARRIVED', 'WORK_STARTED', 'READY_FOR_BILLING', 'PAYMENT_PENDING'];

/** Human-friendly approximate distance from metres. */
function fmtDistance(m?: number | null): string | null {
  if (typeof m !== 'number' || !isFinite(m) || m < 0) return null;
  if (m < 950) return `~${Math.max(50, Math.round(m / 50) * 50)} m`;
  return `~${(m / 1000).toFixed(1)} km`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
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
    primeAudio(); // unlock audio on this user gesture so request beeps can play
    const next = !isOnline;
    setTogglingOnline(true);
    setIsOnline(next); // optimistic
    try {
      await mechanicApi.setAvailability(next);
      // Persist into the shared profile so switching tabs (which remounts this
      // screen) doesn't reset the toggle to a stale value.
      await refreshProfile();
      if (next) {
        mutateRequests();
        pushLocationOnline(); // so dispatch can match us to the NEAREST booking
      }
    } catch {
      setIsOnline(!next); // revert
    } finally {
      setTogglingOnline(false);
    }
  };

  // Capture the device GPS when going online so the backend's nearest-first
  // dispatch has a fresh location to match against. Best-effort, native only.
  const pushLocationOnline = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return;
      const { Geolocation } = await import('@capacitor/geolocation');
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      await mechanicApi.updateLocation(pos.coords.latitude, pos.coords.longitude);
    } catch {
      /* best-effort */
    }
  };

  const accept = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      await mechanicApi.acceptRequest(bookingId);
      mutateRequests();
      mutateBookings();
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

  // Beep + vibrate whenever a new request appears (count grows). primeAudio() is
  // called from the Online toggle (a user gesture) so the sound can play.
  const prevReqCount = useRef(0);
  useEffect(() => {
    if (list.length > prevReqCount.current) playRequestBeep();
    prevReqCount.current = list.length;
  }, [list.length]);

  const outstanding = wallet?.summary?.outstanding ?? 0;
  const lifetime = wallet?.summary?.lifetimeEarnings ?? wallet?.lifetimeEarnings ?? 0;
  const dueAmt = wallet?.due ?? (typeof wallet?.balance === 'number' && wallet.balance < 0 ? Math.abs(wallet.balance) : 0);
  const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="min-h-full bg-cream pb-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-primary to-primary-dark px-5 pb-16 pt-6 text-white shadow-lg shadow-primary/20">
        <span className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <span className="pointer-events-none absolute -left-8 top-24 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/70">Welcome back,</p>
            <h1 className="truncate text-2xl font-extrabold leading-tight">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/notifications')} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur active:scale-95" aria-label="Notifications">
              <Bell className="h-5 w-5 text-white" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-ink">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>
            <button onClick={() => router.push('/profile')} className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/15 text-white ring-2 ring-white/20 active:scale-95">
              {profile?.profileImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Online toggle pill (inside hero) */}
        <div className="relative mt-6 flex items-center justify-between rounded-2xl bg-white/[0.12] px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {isOnline && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-300 opacity-80" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-white/40'}`} />
            </span>
            <div>
              <p className="text-sm font-bold">{isOnline ? "You're Online" : "You're Offline"}</p>
              <p className="text-[11px] text-white/60">{isOnline ? 'Receiving requests nearby' : 'Go online to get requests'}</p>
            </div>
          </div>
          <button onClick={toggleOnline} disabled={togglingOnline} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${isOnline ? 'bg-accent' : 'bg-white/25'}`} aria-label="Toggle online status">
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${isOnline ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>

      {/* Overlapping stat tiles */}
      <div className="relative z-10 -mt-10 grid grid-cols-2 gap-3 px-5">
        <button onClick={() => router.push('/wallet')} className="rounded-2xl bg-white p-4 text-left shadow-md transition-transform active:scale-[0.98]">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/40"><TrendingUp className="h-5 w-5 text-accent-ink" /></div>
          <p className="text-[11px] font-medium text-ink/55">Pending payout</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">{inr(outstanding)}</p>
          <p className="mt-0.5 text-[11px] text-ink/40">Lifetime {inr(lifetime)}</p>
        </button>
        <div className="rounded-2xl bg-white p-4 shadow-md">
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-tint"><Briefcase className="h-5 w-5 text-primary" /></div>
          <p className="text-[11px] font-medium text-ink/55">Active jobs</p>
          <p className="mt-0.5 text-xl font-extrabold text-ink">{activeBookings.length}</p>
          <p className="mt-0.5 text-[11px] text-ink/40">{list.length} new request{list.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      {dueAmt > 0 && (
        <div className="mt-3 px-5">
          <button onClick={() => router.push('/wallet')} className="flex w-full items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left transition-transform active:scale-[0.99]">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0 text-red-600" /><span className="text-sm font-semibold text-red-700">You owe {inr(dueAmt)} to platform</span></span>
            <span className="shrink-0 text-xs font-bold text-red-600">Clear →</span>
          </button>
        </div>
      )}

      {/* New Requests */}
      <div className="mt-7 px-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xl font-extrabold text-ink">New Requests</h3>
          {list.length > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white">{list.length}</span>
          )}
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
                <div key={req.requestId} className={`rounded-3xl bg-white p-3 shadow-sm ${isInstant ? 'ring-1 ring-accent/60' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${isInstant ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {isInstant ? <><Zap className="h-3 w-3" /> INSTANT</> : <><Calendar className="h-3 w-3" /> SCHEDULED</>}
                      </span>
                      {fmtDistance(req.distanceMeters) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-bold text-primary">
                          <MapPin className="h-3 w-3" /> {fmtDistance(req.distanceMeters)} away
                        </span>
                      )}
                    </div>
                    {isInstant && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold tabular-nums ${secondsLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-ink/60'}`}>
                        <Clock className="h-3 w-3" /> {secondsLeft}s
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-[110px] w-[100px] shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary"><Wrench className="h-10 w-10" strokeWidth={1.8} /></div>
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
                        <p className="flex items-center gap-1.5 text-[13px] text-ink/60"><Car className="h-3.5 w-3.5 shrink-0 text-ink/40" /> {[b.vehicle?.make, b.vehicle?.model].filter(Boolean).join(' ')} {b.vehicle?.registrationNumber ? `· ${b.vehicle.registrationNumber}` : ''}</p>
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
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint text-primary"><Wrench className="h-5 w-5" strokeWidth={1.8} /></div>
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
