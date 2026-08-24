import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PublicUser } from '@shared/schema';
import { apiRequest, queryClient, setActiveUserId } from './queryClient';

type AuthValue = {
  user: PublicUser | null;
  isAdmin: boolean;
  /** Sessions live in memory only (storage APIs are blocked in the preview
   *  iframe), so there is never an async restore to wait on. */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<PublicUser>;
  register: (input: { username: string; displayName: string; password: string }) => Promise<PublicUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);

  const adopt = useCallback((next: PublicUser | null) => {
    setActiveUserId(next?.id ?? null);
    setUser(next);
    queryClient.clear();
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await apiRequest('POST', '/api/auth/login', {
        username: username.trim().toLowerCase(),
        password,
      });
      const next = (await res.json()) as PublicUser;
      adopt(next);
      return next;
    },
    [adopt]
  );

  const register = useCallback(
    async (input: { username: string; displayName: string; password: string }) => {
      const res = await apiRequest('POST', '/api/auth/register', {
        ...input,
        username: input.username.trim().toLowerCase(),
      });
      const next = (await res.json()) as PublicUser;
      adopt(next);
      return next;
    },
    [adopt]
  );

  const logout = useCallback(() => adopt(null), [adopt]);

  const value = useMemo<AuthValue>(
    () => ({ user, isAdmin: user?.role === 'admin', isLoading: false, login, register, logout }),
    [user, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
