import { api } from './client';

// Shapes from website/node/ondc-zillybuy-node/controllers/userController.js.
export type User = {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  email_verified?: boolean;
  dob?: string | null;
  role?: number;
  account_status?: string;
  // "none" unless invited to / part of the affiliate programme.
  affiliate_status?: string;
  created_at?: string;
};

export type LoginResponse = {
  success: boolean;
  message?: string;
  token: string;
  role?: number;
  account_status?: string;
  isNewUser?: boolean;
  user: User;
};

type Ok = { success: boolean; message?: string };

// Same as the server's normalizeMobile: digits only, no leading zeros.
export const normalizeMobile = (v = '') => v.replace(/[^\d]/g, '').replace(/^0+/, '');
export const isValidMobile = (v = '') => /^\d{10}$/.test(normalizeMobile(v));
export const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const loginWithPassword = (identifier: string, password: string) => {
  const body = isEmail(identifier)
    ? { email: identifier.trim(), password }
    : { mobile: normalizeMobile(identifier), password };
  return api.post<LoginResponse>('/api/users/login', body).then((r) => r.data);
};

export const sendLoginOtp = (mobile: string) =>
  api.post<Ok>('/api/users/login-otp/send', { mobile: normalizeMobile(mobile) }).then((r) => r.data);

export const verifyLoginOtp = (mobile: string, otp: string) =>
  api
    .post<LoginResponse>('/api/users/login-otp/verify', { mobile: normalizeMobile(mobile), otp })
    .then((r) => r.data);

// One-step login-or-signup by OTP (the website's checkout flow). Unknown
// numbers get an account created, so this is the app's default sign-in path.
export const sendCheckoutOtp = (mobile: string) =>
  api.post<Ok>('/api/users/checkout-otp/send', { mobile: normalizeMobile(mobile) }).then((r) => r.data);

export const verifyCheckoutOtp = (p: { mobile: string; otp: string; name?: string; email?: string }) =>
  api
    .post<LoginResponse>('/api/users/checkout-otp/verify', { ...p, mobile: normalizeMobile(p.mobile) })
    .then((r) => r.data);

export const register = (p: { name: string; mobile: string; email?: string; password: string }) =>
  api
    .post<Ok & { data: { user_id: number } }>('/api/users/register', {
      ...p,
      mobile: normalizeMobile(p.mobile),
    })
    .then((r) => r.data);

// Returns no token — the caller logs in with the same credentials afterwards.
export const verifyRegisterOtp = (user_id: number, otp: string) =>
  api.post<Ok>('/api/users/verify-otp', { user_id, otp }).then((r) => r.data);

export const forgotPassword = (mobile: string) =>
  api.post<Ok>('/api/users/forgot-password', { mobile: normalizeMobile(mobile) }).then((r) => r.data);

export const verifyForgotOtp = (otp: string) =>
  api.post<Ok & { reset_token: string }>('/api/users/verify-forgot-otp', { otp }).then((r) => r.data);

export const resetPassword = (reset_token: string, password: string) =>
  api.post<Ok>('/api/users/reset-password', { reset_token, password }).then((r) => r.data);

export const logoutRequest = () => api.post<Ok>('/api/users/logout').then((r) => r.data);

export const getProfile = () =>
  api.get<{ success: boolean; user: User }>('/api/users/getuser/profile').then((r) => r.data.user);

// Only name and dob are writable here; email changes go through OTP routes.
export const updateProfile = (p: { name?: string; dob?: string | null }) =>
  api.put<Ok>('/api/users/profile', p).then((r) => r.data);

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.put<Ok>('/api/users/change-password', { currentPassword, newPassword }).then((r) => r.data);
