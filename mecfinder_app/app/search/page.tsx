"use client";

import { useState } from 'react';
import useSWR from 'swr';
import BottomNav from '@/components/BottomNav';
import BookingSheet from '@/components/BookingSheet';
import { useBackHandler } from '@/lib/useBackHandler';
import { mechanicServicesApi, categoriesApi } from '@/lib/api';

const fetchCategories = () => categoriesApi.getAll().then(res => res.data || []);
const fetchServices = () => mechanicServicesApi.getAll().then(res => res.data || []);

export default function ServicesPage() {
  const { data: categories } = useSWR('/mobile/categories', fetchCategories);
  const { data: services, isLoading: isServLoading } = useSWR('/mobile/mechanic-services', fetchServices);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<any>(null); // For detail modal
  const [bookingService, setBookingService] = useState<any>(null); // For booking sheet

  // Hardware back closes the detail sheet instead of leaving the screen.
  useBackHandler(!!selectedService, () => setSelectedService(null));

  // Filter services by category if one is selected
  let displayServices = Array.isArray(services) ? services : [];
  if (selectedCategory && selectedCategory !== 'All') {
    displayServices = displayServices.filter((s: any) => s.vehicleCategoryId?.name === selectedCategory);
  }
  if (searchQuery.trim()) {
    displayServices = displayServices.filter((s: any) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] pb-24 font-sans relative overflow-hidden">
      
      {/* Header Section */}
      <div className="px-5 pt-12 pb-2 relative z-10 flex justify-between items-start">
        <div className="max-w-[70%]">
          <h1 className="text-3xl font-black text-[#131F33] tracking-tight">Our Services</h1>
          <p className="text-gray-500 text-[13px] font-medium mt-1">Find the right service for your vehicle</p>
        </div>
        <div className="absolute right-[-10px] top-4 w-40 h-32 pointer-events-none z-20">
          <img src="/img/our_services/upper_logo.png" alt="Mechanic" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex overflow-x-auto gap-3 px-5 no-scrollbar mb-5 mt-2 z-10 relative">
        <button 
          onClick={() => setSelectedCategory('All')}
          className={`shrink-0 px-5 py-2 rounded-full text-sm font-bold transition-all border ${
            selectedCategory === 'All' 
              ? 'bg-[#131F33] text-white border-[#131F33] shadow-md' 
              : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          All
        </button>
        {(Array.isArray(categories) ? categories : []).map((cat: any) => (
          <button 
            key={cat._id}
            onClick={() => setSelectedCategory(cat.name)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 transition-all border ${
              selectedCategory === cat.name 
                ? 'bg-[#131F33] text-white border-[#131F33] shadow-md' 
                : 'bg-white text-gray-700 border-gray-200 shadow-sm'
            }`}
          >
            <span className="text-lg">{cat.emoji}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="px-5 mb-5 z-10 relative">
        <div className="bg-white border border-gray-200 rounded-2xl h-12 flex items-center px-4 shadow-[0_2px_15px_rgb(0,0,0,0.03)] focus-within:border-gray-400 transition-colors">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services (e.g. oil change, brake)" 
            className="w-full bg-transparent border-none text-[13px] font-medium focus:outline-none placeholder:text-gray-400 text-gray-900 px-3"
          />
          <button className="shrink-0 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="px-5 mb-6 z-10 relative">
        <div className="rounded-2xl overflow-hidden w-full relative shadow-[0_4px_15px_rgb(0,0,0,0.05)] border border-[#FBE29F]/30">
          <img src="/img/our_services/banner.png" alt="Quality Service" className="w-full h-auto object-cover" />
        </div>
      </div>

      {/* Section Header */}
      <div className="px-5 flex justify-between items-end mb-4 z-10 relative">
        <h2 className="text-[22px] font-black text-[#131F33]">
          {selectedCategory === 'All' ? 'All Services' : `${selectedCategory} Services`}
        </h2>
        <span className="text-[13px] font-medium text-gray-400 mb-1">{displayServices.length} Services</span>
      </div>

      {/* Services List */}
      <div className="px-5 space-y-4 z-10 relative min-h-[300px]">
        {isServLoading ? (
           <div className="flex justify-center items-center h-32">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#131F33]" />
           </div>
        ) : displayServices.length === 0 ? (
           <div className="text-center py-10 text-gray-500 font-medium bg-gray-50 rounded-3xl border border-gray-100">
             No services found for your selection.
           </div>
        ) : (
          displayServices.map((service: any) => (
            <div 
              key={service._id}
              onClick={() => setSelectedService(service)}
              className="bg-white rounded-[24px] p-3 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex gap-4 cursor-pointer active:scale-[0.98] transition-transform"
            >
              {/* Image Container */}
              <div className="w-[100px] h-[115px] rounded-[18px] bg-[#F5EAE1] flex items-center justify-center shrink-0 overflow-hidden relative border border-[#F5EAE1]/50">
                {service.image ? (
                  <img src={service.image} alt={service.name} className="w-full h-full object-cover mix-blend-multiply" />
                ) : (
                  <span className="text-5xl">{service.vehicleCategoryId?.emoji || '🔧'}</span>
                )}
              </div>
              
              {/* Content Container */}
              <div className="flex-1 py-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-[#131F33] text-[15px] leading-[1.2] line-clamp-2 pr-2">{service.name}</h3>
                    <div className="bg-[#FFF4D9] px-2 py-0.5 rounded-md text-[10px] font-black text-[#966800] flex items-center gap-1 shrink-0 border border-[#FFEBB7]">
                      ★ {service.rating || '4.8'}
                    </div>
                  </div>
                  <p className="text-[12px] text-gray-500 line-clamp-2 leading-[1.3] mb-2 font-medium">
                    {service.description || 'Professional mechanic service for your vehicle.'}
                  </p>
                </div>
                
                <div>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 mb-2">
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      30-45 mins
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm-2 16l-4-4 1.41-1.41L10 15.17l6.59-6.59L18 10l-8 8z" /></svg>
                      Genuine Parts
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#131F33] tracking-tight">₹{service.pricing?.totalPrice || 0}</span>
                      {service.pricing?.servicePrice && (
                        <span className="text-[11px] font-bold text-gray-400 line-through">₹{Math.round(service.pricing.totalPrice * 1.3)}</span>
                      )}
                    </div>
                    <button className="bg-[#FBE29F] hover:bg-[#F3D37A] text-[#5A4510] font-black text-[11px] px-4 py-1.5 rounded-full flex items-center gap-1 transition-colors shadow-sm">
                      VIEW 
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Service Details Modal (BottomSheet style) */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity">
          <div 
            className="w-full max-w-md bg-white rounded-t-[32px] overflow-hidden flex flex-col max-h-[90vh] animate-slide-up"
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Header / Banner */}
            <div className="relative h-56 bg-gradient-to-b from-[#F9F5F0] to-white flex-shrink-0">
              <button 
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-900 z-10 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              {selectedService.banner || selectedService.image ? (
                <img src={selectedService.banner || selectedService.image} alt={selectedService.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-7xl">
                  {selectedService.vehicleCategoryId?.emoji || '🔧'}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
               <div className="flex items-center gap-2 mb-2">
                 <span className="bg-[#F5E6DC] text-[#6D1B2C] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#EBD5C5]">
                   {selectedService.vehicleCategoryId?.name || 'Service'}
                 </span>
                 <span className="bg-[#FFF4D9] px-2 py-0.5 rounded text-[10px] font-black text-[#966800] flex items-center gap-1 border border-[#FFEBB7]">
                   ★ {selectedService.rating || '4.8'}
                 </span>
               </div>
               
               <h2 className="text-2xl font-black text-[#131F33] leading-tight mb-2">{selectedService.name}</h2>
               <p className="text-gray-500 text-sm font-medium leading-relaxed mb-6">
                 {selectedService.description || 'Professional mechanic service ensuring the best care for your vehicle with genuine parts and expert technicians.'}
               </p>

               <div className="space-y-4">
                 <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">🕒</div>
                   <div>
                     <p className="font-bold text-[#131F33] text-sm">Time Required</p>
                     <p className="text-xs text-gray-500 font-medium">30-45 minutes approx</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">🛠️</div>
                   <div>
                     <p className="font-bold text-[#131F33] text-sm">Genuine Spare Parts</p>
                     <p className="text-xs text-gray-500 font-medium">100% original OEM parts used</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-xl">🛡️</div>
                   <div>
                     <p className="font-bold text-[#131F33] text-sm">Service Warranty</p>
                     <p className="text-xs text-gray-500 font-medium">30 days warranty on workmanship</p>
                   </div>
                 </div>
               </div>
            </div>

            {/* Bottom Sticky CTA */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgb(0,0,0,0.05)]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Price</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-[#131F33]">₹{selectedService.pricing?.totalPrice || 0}</span>
                    {selectedService.pricing?.servicePrice && (
                       <span className="text-sm font-bold text-gray-400 line-through">₹{Math.round(selectedService.pricing.totalPrice * 1.3)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setBookingService(selectedService);
                    setSelectedService(null);
                  }}
                  className="flex-1 bg-[#131F33] text-white py-3.5 rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-transform"
                >
                  Book Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      <BookingSheet service={bookingService} onClose={() => setBookingService(null)} />

      <BottomNav activeTab="search" />
    </div>
  );
}
