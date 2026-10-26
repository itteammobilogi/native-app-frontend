import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getProfile, logoutRequest, type LoginResponse, type User } from '@/core/api/auth';
import { setUnauthorizedHandler } from '@/core/api/client';
import {
  clearToken,
  clearUser,
  getStoredUser,
  getToken,
  saveToken,
  saveUser,
} from '@/core/auth/storage';

type AuthState = {
  user: User | null;
  ready: boolean; // false until the stored session has been read on launch
  isLoggedIn: boolean;
  completeLogin: (res: LoginResponse) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(async () => {
    await Promise.all([clearToken(), clearUser()]);
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      const [token, stored] = await Promise.all([getToken(), getStoredUser<User>()]);
      if (token && stored) setUser(stored);
      setReady(true);
      // Revalidate in the background; a 401 here triggers clearSession below.
      if (token) getProfile().then((u) => (setUser(u), saveUser(u))).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Mirrors the website's completeLoginSuccess(): keep token + user.
  const completeLogin = useCallback(async (res: LoginResponse) => {
    if (!res?.success || !res.token) throw new Error(res?.message || 'Login failed');
    await saveToken(res.token);
    await saveUser(res.user);
    setUser(res.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await getProfile();
    setUser(u);
    await saveUser(u);
  }, []);

  // The server only clears its cookie (the JWT isn't blacklisted), so the
  // real logout is dropping the token locally.
  const logout = useCallback(async () => {
    logoutRequest().catch(() => {});
    await clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, ready, isLoggedIn: !!user, completeLogin, refreshUser, logout }),
    [user, ready, completeLogin, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
