'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, ShieldCheck, Settings, FileText, Headphones,
  ChevronRight, LogOut, Camera, Bell, Pencil, CheckCircle2, Landmark, Shield,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { profileService } from '@/lib/services/profile.service';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function ProfileHubScreen() {
  const router = useRouter();
  const { user, profile, loading, logout, loadProfile } = useAuth();
  const { unread } = useNotifications();
  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [user, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleUpdatePhoto = async () => {
    try {
      const permissions = await CapacitorCamera.checkPermissions();
      if (permissions.camera !== 'granted') {
        const requested = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
        if (requested.camera !== 'granted') return;
      }
      const image = await CapacitorCamera.getPhoto({
        quality: 70,
        width: 1280,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });
      if (image.base64String) {
        setUpdatingPhoto(true);
        const dataUrl = `data:image/${image.format};base64,${image.base64String}`;
        await profileService.updateProfileImage(dataUrl);
        await loadProfile();
      }
    } catch (e) {
      console.error('Failed to update photo', e);
    } finally {
      setUpdatingPhoto(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const aadhaar = profile.documents?.find((d) => d.documentType === 'AADHAAR');
  const pan = profile.documents?.find((d) => d.documentType === 'PAN');

  let verificationStatus = 'Pending Verification';
  let statusColor = 'text-yellow-700 bg-yellow-100';
  let verified = false;

  if (aadhaar?.status === 'VERIFIED' && pan?.status === 'VERIFIED') {
    verificationStatus = 'Fully Verified';
    statusColor = 'text-green-700 bg-green-100';
    verified = true;
  } else if (aadhaar?.status === 'REJECTED' || pan?.status === 'REJECTED') {
    verificationStatus = 'Action Required';
    statusColor = 'text-red-700 bg-red-100';
  }

  const menuItems = [
    { title: 'Basic Information', description: 'View and edit personal information', icon: User, href: '/profile/basic-info', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { title: 'Document Verification', description: 'Submit and track identity documents', icon: ShieldCheck, href: '/profile/documents', iconBg: 'bg-green-50', iconColor: 'text-green-600', badge: !verified ? '!' : null, badgeColor: statusColor },
    { title: 'Bank & Payouts', description: 'Bank account for receiving earnings', icon: Landmark, href: '/profile/bank-details', iconBg: 'bg-primary-tint', iconColor: 'text-primary' },
    { title: 'General Settings', description: 'App preferences and account settings', icon: Settings, href: '/profile/settings', iconBg: 'bg-primary-tint', iconColor: 'text-primary' },
    { title: 'Terms & Conditions', description: 'View Mecfinders Terms & Conditions', icon: FileText, href: '/profile/terms', iconBg: 'bg-primary-tint', iconColor: 'text-primary' },
    { title: 'Privacy Policy', description: 'How we handle your data', icon: Shield, href: '/profile/privacy', iconBg: 'bg-primary-tint', iconColor: 'text-primary' },
    { title: 'Help & Support', description: 'Get help or contact support', icon: Headphones, href: '/profile/help', iconBg: 'bg-orange-50', iconColor: 'text-orange-500' },
  ];

  return (
    <div className="min-h-full bg-cream pb-6">
      {/* Header */}
      <div className="relative overflow-hidden px-5 pt-6">
        <div className="pointer-events-none absolute -top-10 right-0 h-40 w-40 rounded-full bg-primary-tint/70 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold leading-none text-primary">My Profile</h1>
            <p className="mt-1 text-sm text-ink/50">Manage your partner account</p>
          </div>
          <button
            onClick={() => router.push('/notifications')}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-ink" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>

        {/* Avatar block */}
        <div className="relative mt-4 flex flex-col items-center">
          <div className="relative">
            {profile.profileImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.profileImage} alt="Profile" className="h-28 w-28 rounded-full border-4 border-white object-cover shadow-md" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white bg-primary-tint shadow-md">
                <User className="h-10 w-10 text-primary/60" />
              </div>
            )}
            <button
              onClick={handleUpdatePhoto}
              disabled={updatingPhoto}
              className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-colors hover:bg-primary-dark disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-ink">{profile.name}</h2>
            <button onClick={() => router.push('/profile/basic-info')}>
              <Pencil className="h-4 w-4 text-ink/40" />
            </button>
          </div>
          <p className="mt-0.5 font-medium text-ink/55">{profile.phone}</p>

          <span className={`mt-2 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusColor}`}>
            {verified && <CheckCircle2 className="h-3.5 w-3.5" />}
            {verificationStatus}
          </span>
        </div>

        {/* Trusted partner banner */}
        <button className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="flex-1 text-left text-sm font-semibold text-ink">Trusted Partner at Mecfinders</span>
          <ChevronRight className="h-5 w-5 text-ink/30" />
        </button>
      </div>

      {/* Account menu */}
      <div className="px-5 pt-6">
        <h3 className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-ink/40">Account</h3>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          {menuItems.map((item, index) => (
            <button
              key={item.title}
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center p-4 text-left transition-colors active:bg-black/[0.03] ${index !== menuItems.length - 1 ? 'border-b border-black/[0.05]' : ''}`}
            >
              <div className={`mr-4 flex h-11 w-11 items-center justify-center rounded-xl ${item.iconBg}`}>
                <item.icon className={`h-5 w-5 ${item.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-ink">{item.title}</h4>
                  {item.badge && (
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${item.badgeColor}`}>{item.badge}</span>
                  )}
                </div>
                <p className="truncate text-sm text-ink/50">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-ink/30" />
            </button>
          ))}

          {/* Logout row */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center border-t border-black/[0.05] p-4 text-left transition-colors active:bg-red-50"
          >
            <div className="mr-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-tint">
              <LogOut className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-primary">Logout</h4>
              <p className="truncate text-sm text-ink/50">Sign out from your account</p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink/30" />
          </button>
        </div>
      </div>
    </div>
  );
}
