'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Inbox, Wallet, Wrench, User } from 'lucide-react';
import useSWR from 'swr';
import { mechanicApi } from '@/lib/api';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Fetch live requests count for the badge
  const { data: requests = [] } = useSWR('mechanic/requests', () => mechanicApi.listRequests(), { refreshInterval: 15000 });
  const requestCount = requests.length;

  const navItems = [
    { label: 'Home', path: '/dashboard', icon: LayoutGrid },
    { label: 'Requests', path: '/requests', icon: Inbox, badge: requestCount },
    { label: 'Wallet', path: '/wallet', icon: Wallet, center: true },
    { label: 'Services', path: '/services', icon: Wrench },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="flex h-screen flex-col bg-cream overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* Bottom Navigation */}
      <div className="pb-safe bg-cream px-3 pb-3 pt-1">
        <div className="flex h-16 items-center justify-around rounded-3xl border border-black/[0.04] bg-white px-2 shadow-[0_-2px_20px_rgba(109,27,44,0.08)]">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;

            if (item.center) {
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className="flex flex-col items-center justify-center -mt-8"
                  aria-label={item.label}
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-primary/30 transition-transform active:scale-95 ${
                      isActive ? 'bg-yellow-500' : 'bg-primary'
                    }`}
                  >
                    <Icon className="h-7 w-7 text-white" strokeWidth={2.2} />
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-bold ${
                      isActive ? 'text-yellow-500' : 'text-ink/50'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="relative flex h-full w-16 flex-col items-center justify-center gap-1 transition-colors"
              >
                <span className={`relative flex items-center justify-center p-1.5 rounded-full transition-colors ${isActive ? 'bg-yellow-500/15' : ''}`}>
                  <Icon
                    className={`h-5 w-5 ${isActive ? 'text-yellow-500' : 'text-ink/40'}`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {item.badge ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white shadow-sm border border-white">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className={`text-[10px] font-semibold transition-all ${isActive ? 'text-yellow-500 font-bold' : 'text-ink/45'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
