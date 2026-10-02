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

// ── Silent token refresh ──────────────────────────────────────────────
// The access token lives only 15m. Without this, every request after that
// window fails with 401 and the user appears "logged out" mid-session. On a
// 401 we exchange the stored refresh token for a fresh pair (rotated server
// side) and replay the original request. A single in-flight promise is shared
// so a burst of concurrent 401s triggers only ONE refresh call.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { value: refreshToken } = await Preferences.get({ key: 'refreshToken' });
  if (!refreshToken) return null;

  // A bare axios call (not `api`) so this request skips the interceptors and
  // can never recurse into another refresh attempt.
  const resp = await axios.post(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } }
  );
  const data = resp.data?.data;
  if (data?.accessToken) {
    await Preferences.set({ key: 'accessToken', value: data.accessToken });
    if (data.refreshToken) {
      await Preferences.set({ key: 'refreshToken', value: data.refreshToken });
    }
    return data.accessToken as string;
  }
  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // Only retry once, and never for the auth endpoints themselves.
    if (
      status === 401 &&
      original &&
      !original._retry &&
      !String(original.url || '').includes('/auth/')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        if (newToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        // fall through — refresh failed
      }
      // Refresh unavailable/expired: clear tokens so the app falls back to the
      // Firebase session (AuthContext re-mints on next load) instead of looping.
      await Preferences.remove({ key: 'accessToken' });
      await Preferences.remove({ key: 'refreshToken' });
    }

    return Promise.reject(error);
  }
);

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
  // Returns the wallet doc flattened with `due` and the online-earning payout
  // `summary` ({ lifetimeEarnings, payableEarnings, paidOut, outstanding, ... }).
  // Optional from/to (YYYY-MM-DD) scope `summary.earnedInRange` for the month filter.
  getWallet: (params?: { from?: string; to?: string }) =>
    api.get('/mobile/mechanic/wallet', { params }).then((r) => {
      const d = r.data?.data;
      return { ...(d?.wallet || {}), due: d?.due ?? 0, summary: d?.summary || null };
    }),
  getWalletTransactions: (params?: { page?: number; limit?: number; from?: string; to?: string }) =>
    api.get('/mobile/mechanic/wallet/transactions', { params }).then((r) => r.data),
  getRatings: () => api.get('/mobile/mechanic/ratings').then((r) => r.data?.data),

  // Payout destination — bank account OR UPI id (settled manually by admin)
  getBankDetails: () =>
    api.get('/mobile/mechanic/bank-details').then((r) => r.data?.data?.bankDetails),
  updateBankDetails: (data: {
    payoutMethod?: 'bank' | 'upi';
    accountHolderName?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    upiId?: string;
  }) => api.put('/mobile/mechanic/bank-details', data).then((r) => r.data?.data?.bankDetails),

  // Platform due settlement — mechanic clears cash-collected dues online.
  // initiate returns { orderId, amount, keyId, settlementId } for checkout.
  initiateDueSettlement: () =>
    api.post('/mobile/mechanic/due/settle/initiate').then((r) => r.data?.data),
  verifyDueSettlement: (data: { orderId: string; paymentId: string; signature: string }) =>
    api.post('/mobile/mechanic/due/settle/verify', data).then((r) => r.data?.data),
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

// Admin-editable Privacy Policy / Terms (public). audience fixed to 'provider'.
export const legalApi = {
  get: (type: 'privacy' | 'terms') =>
    api
      .get(`/mobile/legal/${type}`, { params: { audience: 'provider' } })
      .then((r) => r.data?.data?.document),
};

export default api;
