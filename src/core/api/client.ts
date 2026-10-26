import { create, isAxiosError, type AxiosError } from 'axios';

import { API_BASE_URL, APP_SOURCE } from '@/core/config';
import { getToken } from '@/core/auth/storage';

export const api = create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json', 'x-utm-source': APP_SOURCE },
});

// The website relies on the httpOnly cookie; the app sends the JWT as a Bearer
// header instead, which authMiddleware accepts as a fallback.
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// authMiddleware answers a missing/expired token with a bare 401 {error} (no
// `code`), so any 401 on a request that carried a token means "logged out".
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export const setUnauthorizedHandler = (fn: UnauthorizedHandler | null) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// Backend errors come in two shapes: controllers send {success:false, message},
// the auth middleware sends {error}. Normalise both into one string for toasts.
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (err.code === 'ECONNABORTED') return 'The request timed out. Check your connection.';
    if (!err.response) return 'No internet connection.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
