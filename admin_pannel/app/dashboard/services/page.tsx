'use client';

import { useState, useEffect } from 'react';
import { servicesApi, categoriesApi, citiesApi, Service, Category, City } from '@/lib/api';
import { Filter, Search, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function ListServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      try {
        const params: any = {};
        if (selectedCategory) params.categoryId = selectedCategory;
        if (selectedCity) params.cityId = selectedCity;
        
        const res = await servicesApi.getAll(params);
        setServices(res.data.data.services || []);
      } catch (err) {
        console.error('Failed to fetch services', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [selectedCategory, selectedCity]);

  const filteredServices = services.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Services</h1>
          <p className="text-gray-500">View and filter all services with their pricing</p>
        </div>
        <Link
          href="/dashboard/service-setup"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2"
        >
          <Wrench className="w-4 h-4" />
          Manage via Hierarchy
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-900">Service Name</th>
                <th className="px-6 py-4 font-medium text-gray-900">Category</th>
                <th className="px-6 py-4 font-medium text-gray-900">City</th>
                <th className="px-6 py-4 font-medium text-gray-900">Price (₹)</th>
                <th className="px-6 py-4 font-medium text-gray-900">GST (%)</th>
                <th className="px-6 py-4 font-medium text-gray-900">Total (₹)</th>
                <th className="px-6 py-4 font-medium text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading services...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No services match your filters.
                  </td>
                </tr>
              ) : (
                filteredServices.map((service: any) => (
                  <tr key={service._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{service.name}</td>
                    <td className="px-6 py-4">
                      {service.vehicleCategoryId?.emoji} {service.vehicleCategoryId?.name}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{service.cityId?.name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {service.pricing ? service.pricing.servicePrice : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {service.pricing ? `${service.pricing.gstPercentage}%` : '-'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {service.pricing ? service.pricing.totalPrice : 'Not Set'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${service.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {service.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
