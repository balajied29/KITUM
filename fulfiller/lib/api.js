import axios from 'axios';
import { useAuth, getAccessToken } from './store';
import { refreshAccessToken } from './auth';

const BASE = process.env.EXPO_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, refresh once and retry; on refresh failure, sign out.
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
        useAuth.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export const login = (email, password) => api.post('/auth/login', { email, password });
// Partner application — multipart so we can attach the mandatory camera selfie.
// `photo` is an ImagePicker asset: { uri, name, type }.
export const partnerSignup = ({ photo, ...fields }) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null) fd.append(k, String(v));
  });
  if (photo) fd.append('photo', photo);
  return api.post('/auth/partner-signup', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};
export const logout = (refreshToken) => api.post('/auth/logout', { refreshToken });
// Self-service account deletion (DPDP §12 right to erasure + Play Store requirement).
export const deleteAccount = () => api.delete('/auth/me');
export const getMe = () => api.get('/auth/me'); // refresh user (e.g. approval status)
export const getActiveJob = () => api.get('/fulfiller/active');
export const getHistory = () => api.get('/fulfiller/history');

// KYC documents. `docs` images are { uri, name, type } objects (from ImagePicker);
// any subset may be sent. Numbers are optional strings.
export const getKyc = () => api.get('/fulfiller/kyc');
export const uploadKyc = (docs = {}) => {
  const fd = new FormData();
  if (docs.panImage) fd.append('panImage', docs.panImage);
  if (docs.dlFrontImage) fd.append('dlFrontImage', docs.dlFrontImage);
  if (docs.dlBackImage) fd.append('dlBackImage', docs.dlBackImage);
  if (docs.panNumber != null) fd.append('panNumber', docs.panNumber);
  if (docs.dlNumber != null) fd.append('dlNumber', docs.dlNumber);
  return api.post('/fulfiller/kyc', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
};

// Settlement bank details
export const getBank = () => api.get('/fulfiller/bank');
export const saveBank = (data) => api.put('/fulfiller/bank', data);

// Support tickets (shared customer/partner endpoints — access is scoped to the
// signed-in user, so a partner only ever sees/creates their own tickets).
export const getMyTickets = () => api.get('/support');
export const getTicket = (id) => api.get(`/support/${id}`);
export const createTicket = (payload) => api.post('/support', payload);
export const replyTicket = (id, message) => api.post(`/support/${id}/messages`, { message });
export const closeTicket = (id) => api.patch(`/support/${id}/close`);
export const registerPushToken = (expoPushToken) => api.post('/fulfiller/push-token', { expoPushToken });
export const updateProfile = (data) => api.patch('/fulfiller/profile', data);
// Background-location REST fallback (when the socket can't emit).
export const postLocation = (loc) => api.post('/fulfiller/location', loc);
// Job-status REST mirror (offline fallback for the live-flow journal). Bounded by
// an explicit timeout so a half-open connection can never hang the journal flush
// (a never-settling POST would otherwise wedge the flush loop). Scoped to this
// call so it doesn't shorten legit slow uploads (KYC).
export const postJobStatus = (payload) => api.post('/fulfiller/job-status', payload, { timeout: 15000 });
// Report the customer unreachable at the drop. Server validates the gates and
// returns { ok, dryRunFee, customerRefund } or a 400 with a precise error.
export const postNoShow = (payload) => api.post('/fulfiller/no-show', payload, { timeout: 15000 });

export default api;
