'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { mechanicServicesApi, mechanicServicePricingApi } from '@/lib/api';
import { ArrowLeft, Save, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function MechanicServicePricingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [serviceName, setServiceName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    servicePrice: 0,
    gstPercentage: 0,
    platformFee: 0,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const serviceRes = await mechanicServicesApi.getById(id);
        setServiceName(serviceRes.data.data.name);

        try {
          const pricingRes = await mechanicServicePricingApi.getByServiceId(id);
          const pricingData = pricingRes.data.data;
          // The backend returns data: { pricing: { ... } } or just { ... } depending on the controller structure
          const pricing = pricingData.pricing || pricingData;
          
          if (pricing) {
            setFormData({
              servicePrice: pricing.servicePrice || 0,
              gstPercentage: pricing.gstPercentage || 0,
              platformFee: pricing.platformFee || 0,
            });
          }
        } catch (err: any) {
          if (err.response?.status !== 404) {
            console.error('Failed to fetch pricing', err);
          }
        }
      } catch (err) {
        console.error('Failed to fetch service', err);
        setError('Failed to load service details');
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchInitialData();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await mechanicServicePricingApi.createOrUpdate(id, formData);
      router.push('/dashboard/mechanic-services');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update pricing');
      setSubmitting(false);
    }
  };

  const servicePrice = Number(formData.servicePrice) || 0;
  const gstPercentage = Number(formData.gstPercentage) || 0;
  const platformFee = Number(formData.platformFee) || 0;

  // Assuming simple GST calculation on service price. Adjust if backend uses different logic.
  const gstAmount = (servicePrice * gstPercentage) / 100;
  const completePlatformFee = platformFee; 
  const totalPrice = servicePrice + gstAmount + completePlatformFee;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/mechanic-services"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Pricing</h1>
          <p className="text-gray-500">Service: {serviceName}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Service Price (₹) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.servicePrice}
                  onChange={(e) => setFormData({ ...formData, servicePrice: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">GST Percentage (%) *</label>
              <input
                required
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.gstPercentage}
                onChange={(e) => setFormData({ ...formData, gstPercentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Platform Fee (₹) *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.platformFee}
                  onChange={(e) => setFormData({ ...formData, platformFee: parseFloat(e.target.value) || 0 })}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Live Preview</h3>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service Price</span>
              <span className="font-medium text-gray-900">₹{servicePrice.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST Amount ({gstPercentage}%)</span>
              <span className="font-medium text-gray-900">₹{gstAmount.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Platform Fee</span>
              <span className="font-medium text-gray-900">₹{completePlatformFee.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-base font-bold pt-3 border-t border-gray-200 mt-3">
              <span className="text-gray-900">Total Price</span>
              <span className="text-blue-600">₹{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <Link
              href="/dashboard/mechanic-services"
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
