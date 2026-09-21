import axios from 'axios';
import { Preferences } from '@capacitor/preferences';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://opacity-twisted-rocklike.ngrok-free.dev/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true'
  }
});

api.interceptors.request.use(async (config) => {
  const tokenStr = await Preferences.get({ key: 'accessToken' });
  if (tokenStr.value) {
    config.headers.Authorization = `Bearer ${tokenStr.value}`;
  }
  return config;
});

/**
 * Mechanic (provider) booking-lifecycle API. All routes live under
 * /mobile/mechanic and require an authenticated mechanic (Bearer token).
 */
export const mechanicApi = {
  // Availability & live location
  setAvailability: (isOnline: boolean) =>
    api.patch('/mobile/mechanic/availability', { isOnline }).then((r) => r.data?.data),
  updateLocation: (latitude: number, longitude: number) =>
    api.patch('/mobile/mechanic/location', { latitude, longitude }).then((r) => r.data),

  // Dispatch offers
  listRequests: () => api.get('/mobile/mechanic/requests').then((r) => r.data?.data?.requests || []),
  acceptRequest: (bookingId: string) =>
    api.post(`/mobile/mechanic/requests/${bookingId}/accept`).then((r) => r.data?.data?.booking),
  rejectRequest: (bookingId: string) =>
    api.post(`/mobile/mechanic/requests/${bookingId}/reject`).then((r) => r.data),

  // Assigned bookings
  listBookings: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/mobile/mechanic/bookings', { params }).then((r) => r.data),
  getBooking: (id: string) =>
    api.get(`/mobile/mechanic/bookings/${id}`).then((r) => r.data?.data?.booking),
  arrive: (id: string) =>
    api.post(`/mobile/mechanic/bookings/${id}/arrive`).then((r) => r.data?.data?.booking),
  startWork: (id: string, otp: string) =>
    api.post(`/mobile/mechanic/bookings/${id}/start`, { otp }).then((r) => r.data?.data?.booking),
  addAdditionalService: (id: string, mechanicServiceId: string, reason?: string) =>
    api
      .post(`/mobile/mechanic/bookings/${id}/additional-services`, { mechanicServiceId, reason })
      .then((r) => r.data?.data?.booking),
  updateChecklistItem: (bookingServiceId: string, checklistItemId: string, done: boolean) =>
    api
      .patch(`/mobile/mechanic/booking-services/${bookingServiceId}/checklist`, { checklistItemId, done })
      .then((r) => r.data?.data?.service),
  complete: (id: string) =>
    api.post(`/mobile/mechanic/bookings/${id}/complete`).then((r) => r.data?.data?.booking),
  collectCash: (id: string) =>
    api.post(`/mobile/mechanic/bookings/${id}/collect-cash`).then((r) => r.data?.data?.booking),

  // Wallet & ratings
  getWallet: () => api.get('/mobile/mechanic/wallet').then((r) => r.data?.data?.wallet),
  getWalletTransactions: (params?: { page?: number; limit?: number }) =>
    api.get('/mobile/mechanic/wallet/transactions', { params }).then((r) => r.data),
  getRatings: () => api.get('/mobile/mechanic/ratings').then((r) => r.data?.data),
};

/** Available additional services (MechanicService catalogue) for a category/city. */
export const mechanicServicesApi = {
  getAll: (params?: { cityId?: string; vehicleCategoryId?: string }) =>
    api.get('/mobile/mechanic-services', { params }).then((r) => r.data?.data || []),
};

/** In-app notification feed (shared backend; audience scoped to the mechanic). */
export const notificationsApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    api.get('/mobile/notifications', { params }).then((r) => r.data?.data),
  unreadCount: () =>
    api.get('/mobile/notifications/unread-count').then((r) => r.data?.data?.unread ?? 0),
  markRead: (id: string) =>
    api.post(`/mobile/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.post('/mobile/notifications/read-all').then((r) => r.data),
};

/** Help & Support — FAQs (provider audience derived server-side) + query threads. */
export const supportApi = {
  getFaqs: () => api.get('/mobile/support/faqs').then((r) => r.data?.data),
  getQueries: (params?: { page?: number; limit?: number }) =>
    api.get('/mobile/support/queries', { params }).then((r) => r.data),
  getQuery: (id: string) =>
    api.get(`/mobile/support/queries/${id}`).then((r) => r.data?.data?.query),
  createQuery: (data: { subject: string; message: string; bookingId?: string }) =>
    api.post('/mobile/support/queries', data).then((r) => r.data?.data?.query),
};

export default api;
