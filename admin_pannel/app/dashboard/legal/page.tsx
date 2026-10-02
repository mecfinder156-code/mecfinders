'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher, legalApi, type LegalDocument } from '@/lib/api';
import { FileText, Shield, Save, CheckCircle } from 'lucide-react';

const AUDIENCES = [
  { key: 'customer', label: 'Customer App' },
  { key: 'provider', label: 'Provider App' },
] as const;

const TYPES = [
  { key: 'PRIVACY', label: 'Privacy Policy', icon: Shield },
  { key: 'TERMS', label: 'Terms & Conditions', icon: FileText },
] as const;

export default function LegalPage() {
  const { data, mutate, isLoading } = useSWR('/admin/legal', fetcher);
  const documents: LegalDocument[] = data?.data?.documents || [];

  const [audience, setAudience] = useState<'customer' | 'provider'>('customer');
  const [type, setType] = useState<'PRIVACY' | 'TERMS'>('PRIVACY');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(
    () => documents.find((d) => d.audience === audience && d.type === type),
    [documents, audience, type]
  );

  // Load the selected document into the editor whenever the selection or data changes.
  useEffect(() => {
    if (current) {
      setTitle(current.title || '');
      setContent(current.content || '');
      setSaved(false);
      setError(null);
    }
  }, [current]);

  const save = async () => {
    if (!content.trim()) {
      setError('Content cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await legalApi.update(audience, type, { title, content });
      setSaved(true);
      await mutate();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Legal &amp; Policies</h1>
        <p className="text-gray-500">Edit the Privacy Policy and Terms shown in the customer and provider apps.</p>
      </div>

      {/* Audience + type selectors */}
      <div className="flex flex-wrap gap-3">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${audience === a.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          {TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${type === t.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 animate-pulse">Loading…</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">
              {AUDIENCES.find((a) => a.key === audience)?.label} · {TYPES.find((t) => t.key === type)?.label}
            </h2>
            {current && !current.isDefault && current.updatedAt && (
              <span className="text-xs text-gray-400">Updated {new Date(current.updatedAt).toLocaleString('en-IN')}</span>
            )}
            {current?.isDefault && (
              <span className="text-xs font-medium text-amber-600">Default text (not yet customized)</span>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder={type === 'PRIVACY' ? 'Privacy Policy' : 'Terms & Conditions'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                placeholder="Write the policy text. Blank lines separate paragraphs."
              />
              <p className="mt-1 text-xs text-gray-400">Plain text. Leave a blank line between paragraphs — the apps render each paragraph with spacing.</p>
            </div>

            {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">{error}</div>}
            {saved && !error && (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">
                <CheckCircle className="w-4 h-4" /> Saved — the app will show the new text.
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
