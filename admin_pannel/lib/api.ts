import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — handle 401 by redirecting to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip interceptor for auth endpoints to prevent infinite loops
    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // If 401 and not already retrying, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await api.post('/auth/refresh');
        return api(originalRequest);
      } catch {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// --- SWR Fetcher Utility ---
// This is used by the useSWR hook to automatically fetch data using our configured Axios instance
export const fetcher = (url: string) => api.get(url).then((res) => res.data);

// --- Auth API ---
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get('/auth/me'),

  refresh: () => api.post('/auth/refresh'),
};

// --- Admin Management API ---
export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: string[];
  createdBy?: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const adminApi = {
  create: (data: { name: string; email: string; password: string; permissions?: string[] }) =>
    api.post('/admin/admins', data),

  getAll: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/admins', { params }),

  getById: (id: string) =>
    api.get(`/admin/admins/${id}`),

  update: (id: string, data: { name?: string; email?: string; permissions?: string[] }) =>
    api.patch(`/admin/admins/${id}`, data),

  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/admins/${id}/status`, { isActive }),

  resetPassword: (id: string, password: string) =>
    api.patch(`/admin/admins/${id}/password`, { password }),
};

// --- Vehicle Categories API ---
export interface Category {
  _id: string;
  name: string;
  emoji?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const categoriesApi = {
  getAll: () => api.get('/admin/categories'),
  create: (data: { name: string; description?: string; icon?: string }) =>
    api.post('/admin/categories', data),
  update: (id: string, data: { name?: string; description?: string; icon?: string }) =>
    api.patch(`/admin/categories/${id}`, data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/categories/${id}/status`, { isActive }),
  delete: (id: string) => api.delete(`/admin/categories/${id}`),
};

// --- Cities API ---
export interface City {
  _id: string;
  name: string;
  state: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const citiesApi = {
  getAll: () => api.get('/admin/cities'),
  create: (data: { name: string; state: string }) =>
    api.post('/admin/cities', data),
  update: (id: string, data: { name?: string; state?: string }) =>
    api.patch(`/admin/cities/${id}`, data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/cities/${id}/status`, { isActive }),
  delete: (id: string) => api.delete(`/admin/cities/${id}`),
};

// --- Services API ---
export interface Service {
  _id: string;
  name: string;
  description?: string;
  vehicleCategoryId: string | Category;
  cityId: string | City;
  isActive: boolean;
  pricing?: Pricing;
  createdAt: string;
  updatedAt: string;
}

export interface Pricing {
  _id: string;
  serviceId: string;
  servicePrice: number;
  gstPercentage: number;
  gstAmount: number;
  platformFee: number;
  completePlatformFee: number;
  totalPrice: number;
}

export const servicesApi = {
  getAll: (params?: { categoryId?: string; cityId?: string }) => api.get('/admin/services', { params }),
  create: (data: { name: string; description?: string; vehicleCategoryId: string; cityId: string }) =>
    api.post('/admin/services', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch(`/admin/services/${id}`, data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/services/${id}/status`, { isActive }),
  delete: (id: string) => api.delete(`/admin/services/${id}`),
};

// --- Pricing API ---
export const pricingApi = {
  getByServiceId: (serviceId: string) => api.get(`/admin/pricing/service/${serviceId}`),
  update: (serviceId: string, data: { servicePrice: number; gstPercentage: number; platformFee: number }) =>
    api.put(`/admin/pricing/service/${serviceId}`, data),
};

// --- Users API ---
export interface UserDocument {
  _id: string;
  documentType: 'AADHAAR' | 'PAN';
  documentUrl: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string;
  submittedAt: string;
  verifiedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  profileImage?: string;
  age?: number;
  gender?: string;
  firebaseUid?: string;
  documents?: UserDocument[];
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  getAll: (params?: { page?: number; limit?: number; role?: string; search?: string }) =>
    api.get('/admin/users', { params }),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/users/${id}/status`, { isActive }),
  getById: (id: string) => api.get(`/admin/users/${id}`),
  verifyDocument: (userId: string, docType: string) =>
    api.patch(`/admin/users/${userId}/documents/${docType}/verify`),
  rejectDocument: (userId: string, docType: string, reason: string) =>
    api.patch(`/admin/users/${userId}/documents/${docType}/reject`, { reason }),
};

// --- Mechanic Services API ---
export interface MechanicService {
  _id: string;
  name: string;
  description?: string;
  vehicleCategoryId: string | Category;
  cityId: string | City;
  displayOrder?: number;
  isActive: boolean;
  pricing?: Pricing;
  createdAt: string;
  updatedAt: string;
}

export const mechanicServicesApi = {
  getAll: (params?: { categoryId?: string; cityId?: string; search?: string }) => 
    api.get('/admin/mechanic-services', { params }),
  getById: (id: string) => 
    api.get(`/admin/mechanic-services/${id}`),
  create: (data: { name: string; description?: string; vehicleCategoryId: string; cityId: string; displayOrder?: number }) =>
    api.post('/admin/mechanic-services', data),
  update: (id: string, data: { name?: string; description?: string; vehicleCategoryId?: string; cityId?: string; displayOrder?: number }) =>
    api.patch(`/admin/mechanic-services/${id}`, data),
  updateStatus: (id: string, isActive: boolean) =>
    api.patch(`/admin/mechanic-services/${id}/status`, { isActive }),
  delete: (id: string) => api.delete(`/admin/mechanic-services/${id}`),
};

// --- Mechanic Service Pricing API ---
export const mechanicServicePricingApi = {
  getByServiceId: (serviceId: string) =>
    api.get(`/admin/mechanic-service-pricing/service/${serviceId}`),
  createOrUpdate: (serviceId: string, data: { servicePrice: number; gstPercentage: number; platformFee: number }) =>
    api.put(`/admin/mechanic-service-pricing/service/${serviceId}`, data),
};

// --- Bookings API (operations visibility) ---
export const bookingsApi = {
  getAll: (params?: {
    status?: string;
    bookingType?: string;
    paymentStatus?: string;
    mechanicId?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  }) => api.get('/admin/bookings', { params }),
  getById: (id: string) => api.get(`/admin/bookings/${id}`),
  getStats: () => api.get('/admin/bookings/stats'),
};

// --- Payments API ---
export const paymentsApi = {
  getAll: (params?: { status?: string; method?: string; page?: number; limit?: number }) =>
    api.get('/admin/bookings/payments', { params }),
};

// --- Ratings API ---
export const ratingsApi = {
  getAll: (params?: { mechanicId?: string; page?: number; limit?: number }) =>
    api.get('/admin/bookings/ratings', { params }),
};

// --- Help & Support API ---
export interface Faq {
  _id: string;
  audience: 'customer' | 'provider';
  category: string;
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupportReply {
  _id?: string;
  author: 'user' | 'admin';
  message: string;
  createdAt: string;
}

export interface SupportQuery {
  _id: string;
  userId: string;
  role: string; // customer | mechanic
  name?: string;
  phone?: string;
  email?: string;
  subject: string;
  message: string;
  bookingId?: string | null;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  replies: SupportReply[];
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const supportApi = {
  // FAQs
  getFaqs: (params?: { audience?: 'customer' | 'provider' }) =>
    api.get('/admin/support/faqs', { params }),
  createFaq: (data: {
    audience: 'customer' | 'provider';
    question: string;
    answer: string;
    category?: string;
    order?: number;
    isActive?: boolean;
  }) => api.post('/admin/support/faqs', data),
  updateFaq: (
    id: string,
    data: Partial<{
      audience: 'customer' | 'provider';
      question: string;
      answer: string;
      category: string;
      order: number;
      isActive: boolean;
    }>
  ) => api.patch(`/admin/support/faqs/${id}`, data),
  deleteFaq: (id: string) => api.delete(`/admin/support/faqs/${id}`),

  // Support queries
  getQueries: (params?: { status?: string; role?: string; page?: number; limit?: number }) =>
    api.get('/admin/support/queries', { params }),
  getQuery: (id: string) => api.get(`/admin/support/queries/${id}`),
  replyQuery: (id: string, message: string) =>
    api.post(`/admin/support/queries/${id}/reply`, { message }),
  setQueryStatus: (id: string, status: 'OPEN' | 'ANSWERED' | 'CLOSED') =>
    api.patch(`/admin/support/queries/${id}/status`, { status }),
};
