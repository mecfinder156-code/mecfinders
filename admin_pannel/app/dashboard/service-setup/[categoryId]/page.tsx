'use client';

import { useState, useEffect } from 'react';
import { citiesApi, City } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, MapPin, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SelectCityPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;

  useEffect(() => {
    const fetchCities = async () => {
      try {
        const res = await citiesApi.getAll();
        setCities(res.data.data.cities || []);
      } catch (err) {
        console.error('Failed to fetch cities:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCities();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <Link 
          href="/dashboard/service-setup"
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Categories
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Select City</h1>
          <p className="text-gray-500">Step 2: Select a city for this category</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : cities.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No cities found. Please add cities first.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cities.map((city) => (
            <div
              key={city._id}
              onClick={() => router.push(`/dashboard/service-setup/${categoryId}/${city._id}`)}
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-blue-100 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{city.name}</h3>
                    <p className="text-sm text-gray-500">{city.state}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
