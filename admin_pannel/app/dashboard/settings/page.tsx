'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetcher, settingsApi } from '@/lib/api';
import { Settings as SettingsIcon, ShieldAlert, Save, CheckCircle, Info } from 'lucide-react';

export default function SettingsPage() {
  const { data, error, mutate, isLoading } = useSWR('/admin/settings', fetcher);
  const settings = data?.data?.settings;

  const [maxDueThreshold, setMaxDueThreshold] = useState('');
  const [dispatchRadiusKm, setDispatchRadiusKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setMaxDueThreshold(String(settings.maxDueThreshold ?? ''));
      setDispatchRadiusKm(String(settings.dispatchRadiusKm ?? 10));
    }
  }, [settings]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaved(false);

    const v = Number(maxDueThreshold);
    if (!Number.isFinite(v) || v < 0) {
      setFormError('Due threshold must be a non-negative number (0 disables the block).');
      return;
    }
    const r = Number(dispatchRadiusKm);
    if (!Number.isFinite(r) || r < 1 || r > 500) {
      setFormError('Dispatch radius must be between 1 and 500 km.');
      return;
    }

    setSaving(true);
    try {
      await settingsApi.update({ maxDueThreshold: v, dispatchRadiusKm: r });
      setSaved(true);
      await mutate();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || err?.message || 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Platform Settings</h1>
          <p className="text-sm text-gray-500">Global controls that apply across the platform.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 animate-pulse">
          Loading settings…
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 font-medium">
          {error?.response?.data?.message || 'Failed to load settings.'}
        </div>
      ) : (
        <form onSubmit={save} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/80 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="font-bold text-gray-900">Dispatch Controls</h2>
              <p className="text-sm text-gray-500">Who gets service requests, and how far they can be.</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Maximum Due Threshold (₹)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={maxDueThreshold}
                  onChange={(e) => setMaxDueThreshold(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="1000"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800 leading-relaxed">
                When a mechanic&apos;s unpaid platform due (the GST + platform-fee share collected in
                cash) exceeds this amount, new service requests will not be sent to them until they
                clear it. Set to <span className="font-semibold">0</span> to disable the block entirely.
              </p>
            </div>

            <div className="pt-5 border-t border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Dispatch Search Radius (km)
              </label>
              <div className="relative max-w-xs">
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  value={dispatchRadiusKm}
                  onChange={(e) => setDispatchRadiusKm(e.target.value)}
                  className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">km</span>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 leading-relaxed">
                  Instant requests only reach online mechanics within this distance of the customer,
                  nearest first — so a Delhi customer is never matched to an Agra mechanic. If no
                  mechanic is in range, the booking waits/expires instead of going cross-city.
                  Default <span className="font-semibold">10&nbsp;km</span>.
                </p>
              </div>
            </div>

            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
                {formError}
              </div>
            )}
            {saved && !formError && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                <CheckCircle className="w-4 h-4" /> Settings saved.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
