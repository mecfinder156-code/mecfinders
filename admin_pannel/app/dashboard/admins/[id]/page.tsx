'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { adminApi, type AdminUser } from '@/lib/api';
import { ArrowLeft, Save, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin } = useAuth();
  const router = useRouter();

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/dashboard');
      return;
    }

    const fetchAdmin = async () => {
      try {
        const res = await adminApi.getById(id);
        const data = res.data.data.admin;
        setAdmin(data);
        setName(data.name);
        setEmail(data.email);
      } catch {
        setError('Admin not found');
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
  }, [id, isSuperAdmin, router]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await adminApi.update(id, { name, email });
      setAdmin(res.data.data.admin);
      setSuccess('Admin updated successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update admin');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPasswordLoading(true);

    try {
      await adminApi.resetPassword(id, newPassword);
      setNewPassword('');
      setShowPasswordReset(false);
      setSuccess('Password reset successfully');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!isSuperAdmin) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!admin) {
    return (
      <div>
        <Link
          href="/dashboard/admins"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admins
        </Link>
        <p className="text-red-500">{error || 'Admin not found'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/dashboard/admins"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Admins
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Admin</h1>
      <p className="text-sm text-gray-500 mb-6">
        Status:{' '}
        <span
          className={`font-medium ${
            admin.isActive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {admin.isActive ? 'Active' : 'Inactive'}
        </span>
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm px-4 py-3 rounded-lg border border-green-200 mb-4">
          {success}
        </div>
      )}

      {/* Edit form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <form onSubmit={handleUpdate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Password reset */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Password</h2>
          <button
            onClick={() => setShowPasswordReset(!showPasswordReset)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <KeyRound className="h-4 w-4" />
            Reset Password
          </button>
        </div>

        {showPasswordReset && (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
              />
            </div>
            <button
              type="submit"
              disabled={passwordLoading}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {passwordLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
