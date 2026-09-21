"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addressesApi } from '@/lib/api';
import useSWR from 'swr';
import { Geolocation } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';

const fetcher = () => addressesApi.getAll().then(res => res.data?.addresses || []);

export default function SelectLocationScreen() {
  const router = useRouter();
  const { data: addresses, isLoading } = useSWR('/mobile/addresses', fetcher);
  
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const saveAndGoBack = async (locationName: string, label: string = 'CURRENT') => {
    await Preferences.set({
      key: 'SELECTED_LOCATION',
      value: JSON.stringify({ name: locationName, label })
    });
    router.replace('/dashboard');
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' }
      });
      const data = await res.json();
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    const city = result.address?.city || result.address?.town || result.address?.village || result.name || 'Unknown';
    const state = result.address?.state || '';
    const locName = state ? `${city}, ${state}` : city;
    saveAndGoBack(locName, 'SEARCH');
  };

  const handleUseCurrentLocation = async () => {
    setGpsLoading(true);
    setErrorMsg('');
    try {
      const hasPermission = await Geolocation.checkPermissions();
      if (hasPermission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          setErrorMsg('Location access denied. Please enable it in settings.');
          setGpsLoading(false);
          return;
        }
      }
      
      const position = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`, {
        headers: { 'Accept-Language': 'en-US,en;q=0.9' }
      });
      const data = await res.json();
      
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown';
      const state = data.address?.state || '';
      
      const locName = state ? `${city}, ${state}` : city;
      await saveAndGoBack(locName, 'CURRENT');
    } catch (err: any) {
      console.error('GPS Error:', err);
      setErrorMsg(err.message || 'Failed to fetch GPS location. Please try again.');
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-safe font-sans">
      
      {/* Header */}
      <div className="bg-white px-4 pt-14 pb-4 flex items-center shadow-sm sticky top-0 z-30">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center text-gray-900 active:scale-95 transition-transform -ml-2">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="ml-2">
           <h1 className="text-gray-900 font-extrabold text-lg">Select Location</h1>
           <p className="text-gray-500 text-xs font-medium">To find mechanics near you</p>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        
        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 flex items-center justify-between h-14 mb-4 relative">
          <div className="flex items-center gap-3 px-3 w-full">
            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for area, street name..." 
              className="w-full bg-transparent border-none text-sm font-medium focus:outline-none placeholder:text-gray-400 text-gray-900"
            />
            {searchLoading && <div className="w-4 h-4 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin shrink-0"></div>}
          </div>
        </div>

        {/* Search Results List */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            {searchResults.map((result, idx) => (
              <button 
                key={idx}
                onClick={() => handleSelectSearchResult(result)}
                className={`w-full text-left p-4 flex items-start gap-3 active:bg-gray-50 transition-colors ${idx !== searchResults.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 mt-1">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div>
                  <h4 className="text-gray-900 font-bold text-sm mb-0.5">{result.name}</h4>
                  <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{result.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-xs font-medium p-3 rounded-xl mb-4 border border-red-100">
            {errorMsg}
          </div>
        )}

        {/* Current Location Button */}
        {!searchQuery && (
          <>
            <button 
              onClick={handleUseCurrentLocation}
              disabled={gpsLoading}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 active:scale-[0.98] transition-transform mb-8"
            >
              <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center text-orange-500 shrink-0">
                {gpsLoading ? (
                  <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </div>
              <div className="text-left flex-1">
                <h3 className="text-orange-500 font-bold text-[15px] mb-0.5">Use current location</h3>
                <p className="text-gray-500 text-xs font-medium">Using GPS module</p>
              </div>
              <svg className="w-5 h-5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Saved Addresses */}
            <div className="mb-4">
              <h2 className="text-gray-900 font-extrabold text-lg mb-4 flex items-center gap-2">
                Saved Addresses
              </h2>
              
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
                </div>
              ) : addresses?.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-2xl border border-gray-100 border-dashed">
                  <p className="text-gray-400 text-sm font-medium">No saved addresses found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses?.map((addr: any) => (
                    <button 
                      key={addr._id} 
                      onClick={() => saveAndGoBack(`${addr.addressLine1}, ${addr.city}`, addr.label)}
                      className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 active:scale-[0.98] transition-transform text-left"
                    >
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 shrink-0 mt-0.5">
                        {addr.label === 'HOME' ? '🏠' : addr.label === 'WORK' ? '💼' : '📍'}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                           <h3 className="text-gray-900 font-bold text-[14px]">{addr.label}</h3>
                        </div>
                        <p className="text-gray-500 text-xs font-medium leading-relaxed truncate">
                          {addr.addressLine1}
                        </p>
                        <p className="text-gray-400 text-xs truncate">
                          {addr.city}, {addr.state}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        
      </div>
    </div>
  );
}

