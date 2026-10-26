import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// SecureStore replaces the website's localStorage. It has no web
// implementation, so fall back to localStorage when running `expo start --web`.
const web = Platform.OS === 'web';

async function setItem(key: string, value: string) {
  if (web) return void globalThis.localStorage?.setItem(key, value);
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (web) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string) {
  if (web) return void globalThis.localStorage?.removeItem(key);
  await SecureStore.deleteItemAsync(key);
}

const TOKEN_KEY = 'zb_token';
const USER_KEY = 'zb_user';
const GUEST_KEY = 'zb_guest_id';

// Read on every request by the API client, so keep an in-memory copy.
let cachedToken: string | null | undefined;

export async function getToken() {
  if (cachedToken === undefined) cachedToken = await getItem(TOKEN_KEY);
  return cachedToken;
}

export async function saveToken(token: string) {
  cachedToken = token;
  await setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  cachedToken = null;
  await removeItem(TOKEN_KEY);
}

export async function getStoredUser<T>() {
  const raw = await getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const saveUser = (user: unknown) => setItem(USER_KEY, JSON.stringify(user));
export const clearUser = () => removeItem(USER_KEY);

export const getGuestId = () => getItem(GUEST_KEY);
export const saveGuestId = (id: string) => setItem(GUEST_KEY, id);
export const clearGuestId = () => removeItem(GUEST_KEY);
