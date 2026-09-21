'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, supportApi, type Faq } from '@/lib/api';
import { Plus, Trash2, Edit, X } from 'lucide-react';

type Audience = 'customer' | 'provider';

interface FormState {
  audience: Audience;
  category: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  audience: 'customer',
  category: 'General',
  question: '',
  answer: '',
  order: 0,
  isActive: true,
};

export default function FaqsPage() {
  const [audienceFilter, setAudienceFilter] = useState<'' | Audience>('');
  const swrKey = `/admin/support/faqs${audienceFilter ? `?audience=${audienceFilter}` : ''}`;
  const { data, isLoading, mutate } = useSWR(swrKey, fetcher, { keepPreviousData: true });
  const faqs: Faq[] = data?.data?.faqs || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (faq: Faq) => {
    setEditing(faq);
    setForm({
      audience: faq.audience,
      category: faq.category || 'General',
      question: faq.question,
      answer: faq.answer,
      order: faq.order || 0,
      isActive: faq.isActive,
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await supportApi.updateFaq(editing._id, form);
      } else {
        await supportApi.createFaq(form);
      }
      setIsModalOpen(false);
      setForm(EMPTY_FORM);
      setEditing(null);
      mutate();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this FAQ? This cannot be undone.')) return;
    try {
      await supportApi.deleteFaq(id);
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete FAQ');
    }
  };

  const toggleActive = async (faq: Faq) => {
    try {
      await supportApi.updateFaq(faq._id, { isActive: !faq.isActive });
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update FAQ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Help &amp; Support</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage FAQs shown to customers and providers in the mobile apps.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" /> Add FAQ
        </button>
      </div>

      {/* Audience filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Audience</span>
        <select
          value={audienceFilter}
          onChange={(e) => setAudienceFilter(e.target.value as '' | Audience)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="customer">Customer</option>
          <option value="provider">Provider</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">Audience</th>
              <th className="px-6 py-4 font-medium text-gray-900">Category</th>
              <th className="px-6 py-4 font-medium text-gray-900">Question</th>
              <th className="px-6 py-4 font-medium text-gray-900">Order</th>
              <th className="px-6 py-4 font-medium text-gray-900">Status</th>
              <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : faqs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                  No FAQs found. Add one to get started.
                </td>
              </tr>
            ) : (
              faqs.map((faq) => (
                <tr key={faq._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full capitalize ${
                        faq.audience === 'customer'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {faq.audience}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{faq.category}</td>
                  <td className="px-6 py-4 text-gray-900 max-w-md">
                    <p className="font-medium truncate">{faq.question}</p>
                    <p className="text-xs text-gray-500 truncate">{faq.answer}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-700">{faq.order}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(faq)}>
                      <span
                        className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full cursor-pointer ${
                          faq.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {faq.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => openEdit(faq)}
                        className="text-gray-500 hover:text-blue-600"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(faq._id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editing ? 'Edit FAQ' : 'Add FAQ'}</h2>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
                  <select
                    value={form.audience}
                    onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="customer">Customer</option>
                    <option value="provider">Provider</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Payments"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  required
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer</label>
                <textarea
                  required
                  rows={4}
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display order
                  </label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  Active (visible in app)
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create FAQ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
