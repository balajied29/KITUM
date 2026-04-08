import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Read token from Zustand's persisted 'auth' key — single source of truth
const getToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    const auth = JSON.parse(localStorage.getItem('auth') ?? '{}');
    return auth?.state?.token ?? null;
  } catch {
    return null;
  }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const sendOtp  = (email)      => api.post('/auth/send-otp',  { email });
export const verifyOtp = (email, otp) => api.post('/auth/verify-otp', { email, otp });
export const getMe    = ()            => api.get('/auth/me');

// Products
export const getProducts = () => api.get('/products');

// Slots
export const getSlots = (date, locality) => api.get(`/slots?date=${date}${locality ? `&locality=${encodeURIComponent(locality)}` : ''}`);

// Orders
export const createOrder   = (payload) => api.post('/orders', payload);
export const getUserOrders = ()         => api.get('/orders');
export const getOrderById  = (id)       => api.get(`/orders/${id}`);
export const cancelOrder   = (id)       => api.patch(`/orders/${id}/cancel`);

// Payments
export const createPayment = (orderId) => api.post('/payments/create', { orderId });

// Admin
export const adminGetOrders     = (params)     => api.get('/admin/orders', { params });
export const adminUpdateStatus  = (id, status) => api.patch(`/admin/orders/${id}/status`, { status });
export const adminAssignDriver  = (id, driverId) => api.patch(`/admin/orders/${id}/driver`, { driverId });
export const adminGetSlots      = ()           => api.get('/admin/slots');
export const adminCreateSlot    = (data)       => api.post('/admin/slots', data);
export const adminUpdateSlot    = (id, data)   => api.patch(`/admin/slots/${id}`, data);
export const adminCreateProduct = (data)       => api.post('/admin/products', data);
export const adminUpdateProduct = (id, data)   => api.patch(`/admin/products/${id}`, data);

export default api;
