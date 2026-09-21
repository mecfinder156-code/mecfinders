"use client";

import { useState } from 'react';
import useSWR from 'swr';
import BottomNav from '@/components/BottomNav';
import BookingSheet from '@/components/BookingSheet';
import { servicesApi, categoriesApi } from '@/lib/api';

const fetchCategories = () => categoriesApi.getAll().then(res => res.data || []);
const fetchOriginalServices = () => servicesApi.getPublicServices().then(res => res.data?.data?.services || []);

export default function BookingsPage() {
  const [bookingType, setBookingType] = useState<'instant' | 'schedule'>('instant');
  const [selectedCategory, setSelectedCategory] = useState<string | null>('All');
  const [bookingService, setBookingService] = useState<any>(null);
  
  const { data: categories } = useSWR('/mobile/categories', fetchCategories);
  const { data: services, isLoading: isServLoading } = useSWR('/mobile/services', fetchOriginalServices);

  // Filter services by category if one is selected
  let displayServices = Array.isArray(services) ? services : [];
  if (selectedCategory && selectedCategory !== 'All') {
    displayServices = displayServices.filter((s: any) => s.vehicleCategoryId?.name === selectedCategory);
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFDFD] pb-24 font-sans relative overflow-hidden">

      {/* Header Section */}
      <div className="flex justify-between items-start pt-12 pb-3 px-5 relative z-10">
        <div className="flex-1 mt-2">
          <h1 className="text-[28px] font-black text-[#131F33] leading-tight tracking-tight">Book Service</h1>
          <p className="text-[13px] text-gray-500 font-medium mt-1 leading-snug max-w-[180px]">Choose how you want to proceed</p>
        </div>
        <div className="absolute right-[-10px] top-4 w-[180px] h-32 pointer-events-none z-20">
          <img src="/img/book/book_logo_2.png" alt="Book Mechanic" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Booking Type Toggle */}
      <div className="px-5 mb-6 z-10 relative">
        <div className="bg-gray-100 p-1 rounded-2xl flex relative">
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out"
            style={{ left: bookingType === 'instant' ? '4px' : 'calc(50%)' }}
          />
          <button 
            onClick={() => setBookingType('instant')}
            className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${bookingType === 'instant' ? 'text-[#131F33]' : 'text-gray-500'}`}
          >
            ⚡ Instant Book
          </button>
          <button 
            onClick={() => setBookingType('schedule')}
            className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${bookingType === 'schedule' ? 'text-[#131F33]' : 'text-gray-500'}`}
          >
            📅 Schedule Later
          </button>
        </div>
        {bookingType === 'instant' && (
          <p className="text-[11px] text-green-600 font-bold mt-2 text-center bg-green-50 py-1.5 rounded-lg border border-green-100">
            Mechanic will arrive in 30-45 mins at your location
          </p>
        )}
        {bookingType === 'schedule' && (
          <p className="text-[11px] text-blue-600 font-bold mt-2 text-center bg-blue-50 py-1.5 rounded-lg border border-blue-100">
            Select a preferred date and time for service
          </p>
        )}
      </div>

      {/* Hero Banner */}
      <div className="px-5 mb-5 z-10 relative">
        <div className="rounded-[24px] overflow-hidden shadow-[0_10px_30px_rgb(19,31,51,0.12)] bg-[#131F33]">
          <img
            src="/img/book/book_banner.png"
            alt="Expert mechanics at your doorstep"
            className="w-full h-auto object-cover block"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex overflow-x-auto gap-3 px-5 no-scrollbar mb-5 z-10 relative">
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

      {/* Section Header */}
      <div className="px-5 flex justify-between items-end mb-4 z-10 relative">
        <h2 className="text-[20px] font-black text-[#131F33]">Standard Services</h2>
        <span className="text-[12px] font-medium text-gray-400 mb-1">{displayServices.length} Services</span>
      </div>

      {/* Original Services List */}
      <div className="px-5 space-y-4 z-10 relative">
        {isServLoading ? (
           <div className="flex justify-center items-center h-32">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#131F33]" />
           </div>
        ) : displayServices.length === 0 ? (
           <div className="text-center py-10 text-gray-500 font-medium bg-gray-50 rounded-3xl border border-gray-100">
             No standard services found.
           </div>
        ) : (
          displayServices.map((service: any) => (
            <div 
              key={service._id}
              className="bg-white rounded-[24px] p-3 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex gap-4"
            >
              {/* Image Container */}
              <div className="w-[100px] h-[115px] rounded-[18px] bg-gradient-to-br from-[#F5E6DC] to-[#EBD5C5] flex items-center justify-center shrink-0 overflow-hidden relative border border-[#F5EAE1]/50">
                {service.image ? (
                  <img src={service.image} alt={service.name} className="w-full h-full object-cover mix-blend-multiply" />
                ) : (
                  <span className="text-5xl">{service.vehicleCategoryId?.emoji || '✨'}</span>
                )}
              </div>
              
              {/* Content Container */}
              <div className="flex-1 py-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-[#131F33] text-[15px] leading-[1.2] line-clamp-2 pr-2">{service.name}</h3>
                  </div>
                  <p className="text-[12px] text-gray-500 line-clamp-2 leading-[1.3] mb-2 font-medium">
                    {service.description || 'Standard service for your vehicle.'}
                  </p>
                </div>
                
                <div>
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-[#131F33] tracking-tight">₹{service.pricing?.totalPrice || 0}</span>
                      {service.pricing?.servicePrice && (
                        <span className="text-[11px] font-bold text-gray-400 line-through">₹{Math.round(service.pricing.totalPrice * 1.3)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => setBookingService(service)}
                      className="bg-[#131F33] hover:bg-gray-800 text-white font-black text-[11px] px-5 py-2 rounded-full transition-colors shadow-sm active:scale-95"
                    >
                      BOOK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <BookingSheet service={bookingService} onClose={() => setBookingService(null)} initialType={bookingType} />

      <BottomNav activeTab="bookings" />
    </div>
  );
}
