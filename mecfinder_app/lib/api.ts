import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://opacity-twisted-rocklike.ngrok-free.dev/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'ngrok-skip-browser-warning': 'true' // Bypasses ngrok's HTML warning page
  }
});

api.interceptors.request.use(async (config) => {
  const { value } = await Preferences.get({ key: 'accessToken' });
  if (value) {
    config.headers.Authorization = `Bearer ${value}`;
  }
  return config;
});

export const vehiclesApi = {
  getAll: () => api.get('/mobile/vehicles').then(res => res.data),
  create: (data: unknown) => api.post('/mobile/vehicles', data).then(res => res.data),
  update: (id: string, data: unknown) => api.patch(`/mobile/vehicles/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/mobile/vehicles/${id}`).then(res => res.data),
  setDefault: (id: string) => api.patch(`/mobile/vehicles/${id}/default`).then(res => res.data),
};

export const addressesApi = {
  getAll: () => api.get('/mobile/addresses').then(res => res.data),
  create: (data: unknown) => api.post('/mobile/addresses', data).then(res => res.data),
  update: (id: string, data: unknown) => api.patch(`/mobile/addresses/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/mobile/addresses/${id}`).then(res => res.data),
  setDefault: (id: string) => api.patch(`/mobile/addresses/${id}/default`).then(res => res.data),
};

export const categoriesApi = {
  getAll: () => api.get('/mobile/categories').then(res => res.data),
};

export const profileApi = {
  update: (data: { name?: string; email?: string; age?: number; gender?: string }) =>
    api.patch('/auth/mobile/profile', data).then(res => res.data),
};

export const mechanicServicesApi = {
  getAll: (params?: { cityId?: string; vehicleCategoryId?: string }) => 
    api.get('/mobile/mechanic-services', { params }).then(res => res.data),
};

export const servicesApi = {
  getPublicServices: (params?: { cityId?: string; vehicleCategoryId?: string }) =>
    api.get('/mobile/services', { params }),
};

export interface CreateBookingPayload {
  serviceId: string;
  vehicleId: string;
  bookingType: 'INSTANT' | 'SCHEDULED';
  scheduledAt?: string; // ISO string, required for SCHEDULED
  addressId?: string;
  liveLocation?: {
    latitude?: number;
    longitude?: number;
    formattedAddress?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get('/mobile/notifications', { params }).then((res) => res.data?.data),
  unreadCount: () =>
    api.get('/mobile/notifications/unread-count').then((res) => res.data?.data?.unread ?? 0),
  markRead: (id: string) =>
    api.post(`/mobile/notifications/${id}/read`).then((res) => res.data),
  markAllRead: () => api.post('/mobile/notifications/read-all').then((res) => res.data),
};

export const supportApi = {
  getFaqs: () => api.get('/mobile/support/faqs').then((res) => res.data?.data),
  getQueries: (params?: { page?: number; limit?: number }) =>
    api.get('/mobile/support/queries', { params }).then((res) => res.data),
  getQuery: (id: string) =>
    api.get(`/mobile/support/queries/${id}`).then((res) => res.data?.data?.query),
  createQuery: (data: { subject: string; message: string; bookingId?: string }) =>
    api.post('/mobile/support/queries', data).then((res) => res.data?.data?.query),
};

export const bookingsApi = {
  create: (data: CreateBookingPayload) =>
    api.post('/mobile/bookings', data).then((res) => res.data?.data?.booking),
  getAll: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/mobile/bookings', { params }).then((res) => res.data),
  getById: (id: string) =>
    api.get(`/mobile/bookings/${id}`).then((res) => res.data?.data?.booking),
  cancel: (id: string, reason?: string) =>
    api.post(`/mobile/bookings/${id}/cancel`, { reason }).then((res) => res.data?.data?.booking),
  respondAdditional: (id: string, itemId: string, accept: boolean) =>
    api
      .post(`/mobile/bookings/${id}/additional-services/${itemId}/respond`, { accept })
      .then((res) => res.data?.data?.booking),
  pay: (id: string, method: 'CASH' | 'RAZORPAY') =>
    api.post(`/mobile/bookings/${id}/pay`, { method }).then((res) => res.data?.data),
  verifyRazorpay: (
    id: string,
    data: { orderId: string; paymentId: string; signature: string }
  ) => api.post(`/mobile/bookings/${id}/pay/razorpay/verify`, data).then((res) => res.data?.data?.booking),
  submitRating: (id: string, data: { rating: number; feedback?: string }) =>
    api.post(`/mobile/bookings/${id}/rating`, data).then((res) => res.data?.data?.rating),
};
