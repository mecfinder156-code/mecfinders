'use client';

import { useEffect, useState, useCallback } from 'react';
import { usersApi, type User, type PaginationInfo } from '@/lib/api';
import Link from 'next/link';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Build the SWR key based on query parameters
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('limit', '10');
  if (search) queryParams.append('search', search);
  if (roleFilter) queryParams.append('role', roleFilter);
  
  const swrKey = `/admin/users?${queryParams.toString()}`;
  const { data, error, mutate, isLoading } = useSWR(swrKey, fetcher, {
    keepPreviousData: true, // Smooth transition between pages
  });

  const users: User[] = data?.data || [];
  const pagination: PaginationInfo | null = data?.pagination || null;

  const handleToggleStatus = async (user: User) => {
    setStatusLoading(user._id);
    try {
      await usersApi.updateStatus(user._id, !user.isActive);
      // Immediately invalidate cache to trigger background refetch
      mutate(); 
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setStatusLoading(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </form>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          >
            <option value="">All Roles</option>
            <option value="customer">Customer</option>
            <option value="mechanic">Mechanic</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email / Phone
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{user.email || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{user.phone || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Banned'}
                        </span>
                        {user.role === 'mechanic' && user.requestsPaused && (
                          <span className="inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                            Requests paused
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        <Link
                          href={`/dashboard/users/${user._id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          View Details
                        </Link>
                        <button
                          onClick={() => handleToggleStatus(user)}
                          disabled={statusLoading === user._id}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title={user.isActive ? 'Ban' : 'Unban'}
                        >
                          {user.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total}{' '}
              total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

