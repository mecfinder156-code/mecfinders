'use client';

import { useAuth } from '@/lib/auth';
import { Shield, Users } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome, {user?.name}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Role card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Your Role</h2>
          </div>
          <p className="text-2xl font-bold text-gray-900 capitalize">
            {user?.role}
          </p>
          <p className="text-sm text-gray-500 mt-1">{user?.email}</p>
        </div>

        {/* Admin management card — SuperAdmin only */}
        {isSuperAdmin && (
          <Link href="/dashboard/admins" className="block">
            <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Admin Management
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                Create, view, and manage admin users
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
