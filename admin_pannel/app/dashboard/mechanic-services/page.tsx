'use client';

import { useState, useEffect } from 'react';
import { mechanicServicesApi, categoriesApi, citiesApi, type MechanicService, type Category, type City } from '@/lib/api';
import { Filter, Search, Plus, Edit, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function MechanicServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [catRes, cityRes] = await Promise.all([
          categoriesApi.getAll(),
          citiesApi.getAll()
        ]);
        setCategories(catRes.data.data.categories || []);
        setCities(cityRes.data.data.cities || []);
      } catch (err) {
        console.error('Failed to fetch filter data', err);
      }
    };
    fetchInitialData();
  }, []);

  const queryParams = new URLSearchParams();
  if (selectedCategory) queryParams.append('categoryId', selectedCategory);
  if (selectedCity) queryParams.append('cityId', selectedCity);
  if (searchQuery) queryParams.append('search', searchQuery);

  const swrKey = `/admin/mechanic-services?${queryParams.toString()}`;
  const { data, isLoading, mutate } = useSWR(swrKey, fetcher, {
    keepPreviousData: true,
  });

  const services: MechanicService[] = data?.data?.services || [];

  const handleToggleStatus = async (service: MechanicService) => {
    setStatusLoading(service._id);
    try {
      await mechanicServicesApi.updateStatus(service._id, !service.isActive);
      mutate();
    } catch (err) {
      console.error('Failed to update status', err);
    } finally {
      setStatusLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mechanic Services</h1>
          <p className="text-gray-500">Manage mechanics services, pricing, and availability</p>
        </div>
        <Link
          href="/dashboard/mechanic-services/setup"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Service
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search service name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="text-gray-400 w-5 h-5" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.emoji} {c.name}</option>)}
          </select>
          
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="py-2 px-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white min-w-[150px]"
          >
            <option value="">All Cities</option>
            {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No mechanic services found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-900">Service Name</th>
                  <th className="px-6 py-4 font-medium text-gray-900">Category</th>
                  <th className="px-6 py-4 font-medium text-gray-900">City</th>
                  <th className="px-6 py-4 font-medium text-gray-900">Total Price (₹)</th>
                  <th className="px-6 py-4 font-medium text-gray-900">Status</th>
                  <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {services.map((service) => (
                  <tr key={service._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{service.name}</td>
                    <td className="px-6 py-4">
                      {typeof service.vehicleCategoryId === 'object' ? `${service.vehicleCategoryId.emoji} ${service.vehicleCategoryId.name}` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {typeof service.cityId === 'object' ? service.cityId.name : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {service.pricing ? service.pricing.totalPrice : 'Not Set'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${service.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 items-center">
                        <Link
                          href={`/dashboard/mechanic-services/${service._id}`}
                          className="text-gray-400 hover:text-blue-600"
                          title="Edit Service"
                        >
                          <Edit className="w-5 h-5" />
                        </Link>
                        <Link
                          href={`/dashboard/mechanic-services/${service._id}/pricing`}
                          className="text-gray-400 hover:text-green-600"
                          title="Manage Pricing"
                        >
                          <DollarSign className="w-5 h-5" />
                        </Link>
                        <button
                          onClick={() => handleToggleStatus(service)}
                          disabled={statusLoading === service._id}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          title={service.isActive ? 'Disable' : 'Enable'}
                        >
                          {service.isActive ? (
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
      </div>
    </div>
  );
}
