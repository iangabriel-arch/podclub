import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '@shared/schema';
import { apiRequest, queryClient, setActiveUserId } from './queryClient';

type AuthValue = {
  user: PublicUser | null;
  isAdmin: boolean;
  /** True while a stored session is being restored on first paint. */
  isLoading: boolean;
  login: (username: string, password: string) => Promise<PublicUser>;
  register: (input: { username: string; displayName: string; password: string }) => Promise<PublicUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const STORAGE_KEY = 'podclub.userId';

/**
 * Storage APIs throw in sandboxed iframes (the in-thread preview runs on an opaque
 * origin), so every access is guarded. On a real domain the session survives a
 * reload; in the preview it falls back to memory only.
 */
function readStoredId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const id = raw === null ? NaN : Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function writeStoredId(id: number | null) {
  try {
    if (id === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* preview iframe — memory only */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(() => readStoredId() !== null);

  const adopt = useCallback((next: PublicUser | null) => {
    setActiveUserId(next?.id ?? null);
    writeStoredId(next?.id ?? null);
    setUser(next);
    queryClient.clear();
  }, []);

  // Restore a stored session once, on mount.
  useEffect(() => {
    const storedId = readStoredId();
    if (storedId === null) return;

    let cancelled = false;
    setActiveUserId(storedId);

    apiRequest('GET', '/api/auth/me')
      .then((res) => res.json() as Promise<PublicUser>)
      .then((restored) => {
        if (cancelled) return;
        setUser(restored);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveUserId(null);
        writeStoredId(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
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
    () => ({ user, isAdmin: user?.role === 'admin', isLoading, login, register, logout }),
    [user, isLoading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
