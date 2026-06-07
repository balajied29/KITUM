import axios from 'axios';
import { activeAuthStore } from './store';
import { refreshAccessToken } from './auth';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the current short-lived access token (from whichever session — customer
// or admin — owns the current area).
api.interceptors.request.use((config) => {
  const token = activeAuthStore().getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, transparently refresh once and retry. If refresh fails, log out of the
// CURRENT area only (admin → /admin/login, customer → /login).
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        activeAuthStore().getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const register        = (name, email, password) => api.post('/auth/register', { name, email, password });
export const login           = (email, password)        => api.post('/auth/login',    { email, password });
export const getMe           = ()                       => api.get('/auth/me');
export const updateProfile   = (data)                   => api.patch('/auth/me', data);
export const deleteAccount   = ()                       => api.delete('/auth/me');
export const logout          = (refreshToken)           => api.post('/auth/logout', { refreshToken });
export const forgotPassword  = (email)                  => api.post('/auth/forgot-password', { email });
export const resetPassword   = (token, password)        => api.post('/auth/reset-password', { token, password });

// Products
// Display order: tankers first, largest capacity → smallest; then jars/bottles
// (tankerLitres 0) at the end, cheapest first. Centralised here so every product
// list (home, instant, tanker, scheduled catalogue) stays consistent.
const orderProductsForDisplay = (list) =>
  [...list].sort(
    (a, b) => (b.tankerLitres || 0) - (a.tankerLitres || 0) || (a.price || 0) - (b.price || 0)
  );
export const getProducts = async () => {
  const res = await api.get('/products');
  if (Array.isArray(res.data?.data)) res.data.data = orderProductsForDisplay(res.data.data);
  return res;
};

// Slots
export const getSlots = (date, locality) => api.get(`/slots?date=${date}${locality ? `&locality=${encodeURIComponent(locality)}` : ''}`);

// Orders
export const createOrder   = (payload) => api.post('/orders', payload);
export const getUserOrders = ()         => api.get('/orders');
export const getOrderById  = (id)       => api.get(`/orders/${id}`);
export const cancelOrder   = (id)       => api.patch(`/orders/${id}/cancel`);

// Instant (ride-hailing) requests
export const createRequest   = (payload) => api.post('/requests', payload);
export const getMyRequests   = ()        => api.get('/requests');
export const getRequestById  = (id)      => api.get(`/requests/${id}`);
export const cancelRequest   = (id)      => api.post(`/requests/${id}/cancel`);
export const rateRequest     = (id, rating) => api.post(`/requests/${id}/rate`, { rating });

// Saved addresses
export const getAddresses   = ()         => api.get('/addresses');
export const createAddress  = (data)     => api.post('/addresses', data);
export const updateAddress  = (id, data) => api.patch(`/addresses/${id}`, data);
export const deleteAddress  = (id)       => api.delete(`/addresses/${id}`);

// Payments — collected at delivery (UPI at the door). createX builds the Razorpay
// order on demand; verifyX confirms it.
export const createPayment = (orderId) => api.post('/payments/create', { orderId });
export const createRequestPayment = (requestId) => api.post('/payments/requests/create', { requestId });
export const verifyOrderPayment = (payload) => api.post('/payments/orders/verify', payload);
export const verifyRequestPayment = (payload) => api.post('/payments/requests/verify', payload);

// Admin
export const adminGetOrders     = (params)     => api.get('/admin/orders', { params });
export const adminUpdateStatus  = (id, status) => api.patch(`/admin/orders/${id}/status`, { status });
export const adminAssignDriver  = (id, driverId) => api.patch(`/admin/orders/${id}/driver`, { driverId });
export const adminGetOrderCandidates = (id)      => api.get(`/admin/orders/${id}/candidates`);
export const adminGetSlots      = ()           => api.get('/admin/slots');
export const adminCreateSlot    = (data)       => api.post('/admin/slots', data);
export const adminUpdateSlot    = (id, data)   => api.patch(`/admin/slots/${id}`, data);
export const adminCreateProduct = (data)       => api.post('/admin/products', data);
export const adminUpdateProduct = (id, data)   => api.patch(`/admin/products/${id}`, data);

// Admin — partners / fulfillers
export const adminGetFulfillers  = ()           => api.get('/admin/fulfillers');
export const adminCreateFulfiller = (data)      => api.post('/admin/fulfillers', data);
export const adminUpdateFulfiller = (id, data)  => api.patch(`/admin/fulfillers/${id}`, data);
export const adminApproveFulfiller = (id)       => api.post(`/admin/fulfillers/${id}/approve`);
export const adminRejectFulfiller  = (id, reason) => api.post(`/admin/fulfillers/${id}/reject`, { reason });
export const adminDeleteFulfiller  = (id)       => api.delete(`/admin/fulfillers/${id}`);
export const adminGetFulfillerKyc  = (id)       => api.get(`/admin/fulfillers/${id}/kyc`);
export const adminVerifyFulfillerKyc = (id)     => api.post(`/admin/fulfillers/${id}/kyc/verify`);
export const adminRejectFulfillerKyc = (id, reason) => api.post(`/admin/fulfillers/${id}/kyc/reject`, { reason });

// Admin — launch-offer campaigns (see docs/launch-offers-design.md)
export const adminGetCampaigns      = ()              => api.get('/admin/campaigns');
export const adminUpdateCampaign    = (key, data)    => api.patch(`/admin/campaigns/${key}`, data);
export const adminGetCampaignGrants = (key)          => api.get(`/admin/campaigns/${key}/grants`);
export const adminGrantCampaign     = (key, payload) => api.post(`/admin/campaigns/${key}/grant`, payload);
export const adminRevokeCampaign    = (key, userId)  => api.post(`/admin/campaigns/${key}/revoke`, { userId });

// Reviews
export const createReview         = (payload)     => api.post('/reviews', payload);
export const getReviewForDelivery = (source, id)  => api.get(`/reviews/mine?source=${source}&id=${id}`);
export const adminGetReviews      = (params)      => api.get('/admin/reviews', { params });
export const adminSetReviewStatus = (id, status)  => api.patch(`/admin/reviews/${id}/status`, { status });

// Support tickets (customer)
export const createTicket  = (payload)      => api.post('/support', payload);
export const getMyTickets  = ()             => api.get('/support');
export const getTicket     = (id)           => api.get(`/support/${id}`);
export const replyTicket   = (id, message)  => api.post(`/support/${id}/messages`, { message });
export const closeTicket   = (id)           => api.patch(`/support/${id}/close`);

// Support tickets (admin)
export const adminGetTickets        = (params)      => api.get('/admin/tickets', { params });
export const adminGetTicket         = (id)          => api.get(`/admin/tickets/${id}`);
export const adminReplyTicket       = (id, message) => api.post(`/admin/tickets/${id}/messages`, { message });
export const adminUpdateTicketStatus = (id, status) => api.patch(`/admin/tickets/${id}/status`, { status });

export default api;
