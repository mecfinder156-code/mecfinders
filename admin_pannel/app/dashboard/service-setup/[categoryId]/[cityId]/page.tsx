'use client';

import { useState, useEffect } from 'react';
import { servicesApi, pricingApi, Service } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Plus, Trash2, X, DollarSign, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ServicesPage() {
  const params = useParams();
  const categoryId = params.categoryId as string;
  const cityId = params.cityId as string;

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Service Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ name: '', description: '', image: '', banner: '' });
  const [addError, setAddError] = useState('');

  // Pricing Modal state
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [pricingError, setPricingError] = useState('');
  
  // Pricing inputs
  const [servicePrice, setServicePrice] = useState<number>(0);
  const [gstPercentage, setGstPercentage] = useState<number>(18);
  const [platformFee, setPlatformFee] = useState<number>(0);

  // Derived fields
  const gstAmount = Number(((servicePrice * gstPercentage) / 100).toFixed(2));
  const totalPrice = Number((servicePrice + gstAmount + platformFee).toFixed(2));
  const completePlatformFee = Number((totalPrice - servicePrice).toFixed(2));

  const fetchServices = async () => {
    try {
      const res = await servicesApi.getAll({ categoryId, cityId });
      setServices(res.data.data.services || []);
    } catch (err) {
      console.error('Failed to fetch services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [categoryId, cityId]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await servicesApi.create({
        ...addFormData,
        vehicleCategoryId: categoryId,
        cityId,
      });
      setIsAddModalOpen(false);
      setAddFormData({ name: '', description: '', image: '', banner: '' });
      fetchServices();
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      const data = err.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        const errorDetails = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        setAddError(`${data.message || 'Validation failed'} - ${errorDetails}`);
      } else {
        setAddError(data?.message || 'Failed to create service');
      }
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await servicesApi.updateStatus(id, !currentStatus);
      fetchServices();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await servicesApi.delete(id);
      fetchServices();
    } catch (err) {
      console.error('Failed to delete service', err);
    }
  };

  const openPricingModal = async (service: Service) => {
    setSelectedServiceId(service._id);
    setIsPricingModalOpen(true);
    setPricingError('');
    
    try {
      const res = await pricingApi.getByServiceId(service._id);
      const pricing = res.data.data.pricing;
      if (pricing) {
        setServicePrice(pricing.servicePrice ?? 0);
        setGstPercentage(pricing.gstPercentage ?? 18);
        setPlatformFee(pricing.platformFee ?? 0);
      } else {
        // defaults
        setServicePrice(0);
        setGstPercentage(18);
        setPlatformFee(0);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
      // fallback
      setServicePrice(0);
      setGstPercentage(18);
      setPlatformFee(0);
    }
  };

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) return;
    try {
      await pricingApi.update(selectedServiceId, {
        servicePrice: Number(servicePrice),
        gstPercentage: Number(gstPercentage),
        platformFee: Number(platformFee),
      });
      setIsPricingModalOpen(false);
      fetchServices(); // refresh services to potentially show updated pricing info
    } catch (err: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) {
      const data = err.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        const errorDetails = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        setPricingError(`${data.message || 'Validation failed'} - ${errorDetails}`);
      } else {
        setPricingError(data?.message || 'Failed to update pricing');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <Link 
          href={`/dashboard/service-setup/${categoryId}`}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Cities
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Services</h1>
            <p className="text-gray-500">Step 3: Manage services & pricing</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Add Service
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">Name</th>
              <th className="px-6 py-4 font-medium text-gray-900">Description</th>
              <th className="px-6 py-4 font-medium text-gray-900">Status</th>
              <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No services found for this category and city
                </td>
              </tr>
            ) : (
              services.map((service) => (
                <tr key={service._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{service.name}</td>
                  <td className="px-6 py-4 text-gray-500">{service.description || '-'}</td>
                  <td className="px-6 py-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={service.isActive}
                        onChange={() => handleToggleStatus(service._id, service.isActive)}
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openPricingModal(service)}
                      className="text-blue-600 hover:text-blue-900 p-2 mr-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Manage Pricing"
                    >
                      <DollarSign className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(service._id)}
                      className="text-red-600 hover:text-red-900 p-2"
                      title="Delete Service"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Service Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Service</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              {addError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{addError}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={addFormData.description}
                  onChange={(e) => setAddFormData({ ...addFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setAddFormData({ ...addFormData, image: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                />
                {addFormData.image && (
                  <div className="mt-2 w-20 h-20 rounded border overflow-hidden">
                    <img src={addFormData.image} className="w-full h-full object-cover" alt="thumb" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setAddFormData({ ...addFormData, banner: reader.result as string });
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                />
                {addFormData.banner && (
                  <div className="mt-2 w-full h-24 rounded border overflow-hidden">
                    <img src={addFormData.banner} className="w-full h-full object-cover" alt="banner" />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Pricing Modal */}
      {isPricingModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg my-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Manage Pricing</h2>
              <button onClick={() => setIsPricingModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePricingSubmit} className="space-y-6">
              {pricingError && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{pricingError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Editable Fields */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 border-b pb-2">Input Fields</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Service Price (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={servicePrice}
                      onChange={(e) => setServicePrice(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Percentage (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.1"
                      value={gstPercentage}
                      onChange={(e) => setGstPercentage(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform Fee (₹)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={platformFee}
                      onChange={(e) => setPlatformFee(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Calculated Fields (Read Only) */}
                <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-800 border-b pb-2">Calculated (Read-only)</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">GST Amount (₹)</label>
                    <input
                      type="number"
                      readOnly
                      value={gstAmount}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Total Price (₹)</label>
                    <input
                      type="number"
                      readOnly
                      value={totalPrice}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Complete Platform Fee (₹)</label>
                    <input
                      type="number"
                      readOnly
                      value={completePlatformFee}
                      className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">Total Price - Service Price</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsPricingModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Pricing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
