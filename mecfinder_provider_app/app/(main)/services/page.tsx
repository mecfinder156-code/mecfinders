'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Search, Wrench } from 'lucide-react';
import { mechanicServicesApi } from '@/lib/api';

export default function ServicesScreen() {
  const [query, setQuery] = useState('');
  const { data: services, isLoading } = useSWR('mechanic-services-all', () => mechanicServicesApi.getAll());

  const list = services || [];
  const filtered = useMemo(
    () => list.filter((s: any) => s.name?.toLowerCase().includes(query.trim().toLowerCase())),
    [list, query]
  );

  return (
    <div className="min-h-full bg-cream pb-6">
      <div className="px-5 pt-6">
        <h1 className="text-[26px] font-extrabold leading-none text-primary">Services Catalogue</h1>
        <p className="mt-1 text-sm text-ink/50">Additional services you can offer during a job</p>

        <div className="mt-4 flex h-12 items-center gap-2 rounded-2xl border border-black/[0.04] bg-white px-4 shadow-sm">
          <Search className="h-5 w-5 text-ink/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services…"
            className="flex-1 bg-transparent text-sm font-medium text-ink placeholder:text-ink/40 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-5 space-y-3 px-5">
        {isLoading ? (
          <p className="py-10 text-center text-sm font-medium text-ink/50">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white py-10 text-center text-sm font-medium text-ink/50">
            {query ? `No services match “${query}”.` : 'No services available yet.'}
          </div>
        ) : (
          filtered.map((service: any) => (
            <div key={service._id} className="flex gap-4 rounded-[24px] bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="flex h-[90px] w-[90px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-primary-tint text-4xl">
                {service.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={service.image} alt={service.name} className="h-full w-full object-cover" />
                ) : (
                  <Wrench className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 pr-1 text-[15px] font-bold leading-tight text-ink">{service.name}</h3>
                    {service.vehicleCategoryId?.name && (
                      <span className="shrink-0 rounded-md border border-accent-dark/40 bg-accent/40 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-ink">
                        {service.vehicleCategoryId.name}
                      </span>
                    )}
                  </div>
                  {service.description && <p className="mt-1 line-clamp-1 text-[13px] text-ink/50">{service.description}</p>}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-xl font-black tracking-tight text-ink">
                    ₹{service.pricing?.totalPrice ?? '—'}
                  </span>
                  {service.pricing?.servicePrice != null && (
                    <span className="text-[11px] font-semibold text-ink/40">incl. taxes</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
