'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Search, Wrench, X } from 'lucide-react';
import { mechanicServicesApi } from '@/lib/api';

export default function ServicesScreen() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
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
            <button key={service._id} onClick={() => setSelected(service)} className="flex w-full gap-4 rounded-[24px] bg-white p-3 text-left shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.99] transition-transform">
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
            </button>
          ))
        )}
      </div>

      {/* Service detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-cream" onClick={(e) => e.stopPropagation()} style={{ animation: 'sheetUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            {/* Banner */}
            <div className="relative h-44 w-full overflow-hidden bg-primary-tint">
              {selected.banner || selected.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selected.banner || selected.image} alt={selected.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center"><Wrench className="h-14 w-14 text-primary" /></div>
              )}
              <button onClick={() => setSelected(null)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink shadow active:scale-95">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pb-8 pt-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-extrabold leading-tight text-ink">{selected.name}</h2>
                {selected.vehicleCategoryId?.name && (
                  <span className="shrink-0 rounded-md border border-accent-dark/40 bg-accent/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-accent-ink">{selected.vehicleCategoryId.name}</span>
                )}
              </div>

              {selected.description && <p className="mt-2 text-sm leading-relaxed text-ink/60">{selected.description}</p>}

              {/* Price breakdown */}
              <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/45">Pricing</p>
                <div className="space-y-1.5 text-sm">
                  {selected.pricing?.servicePrice != null && (
                    <div className="flex justify-between"><span className="text-ink/60">Service charge</span><span className="font-semibold text-ink">₹{selected.pricing.servicePrice}</span></div>
                  )}
                  {selected.pricing?.gstAmount ? (
                    <div className="flex justify-between"><span className="text-ink/60">GST</span><span className="font-semibold text-ink">₹{selected.pricing.gstAmount}</span></div>
                  ) : null}
                  {selected.pricing?.platformFee ? (
                    <div className="flex justify-between"><span className="text-ink/60">Platform fee</span><span className="font-semibold text-ink">₹{selected.pricing.platformFee}</span></div>
                  ) : null}
                  <div className="mt-1 flex justify-between border-t border-gray-100 pt-2"><span className="font-bold text-ink">Total</span><span className="text-lg font-extrabold text-primary">₹{selected.pricing?.totalPrice ?? '—'}</span></div>
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-ink/45">You can add this service to a job while work is in progress.</p>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: `@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}` }} />
        </div>
      )}
    </div>
  );
}
