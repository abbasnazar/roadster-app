import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  setAuthSession,
} from './storage';

export type SessionRole = 'customer' | 'seller' | null;

export type SessionUser = {
  id?: number;
  name?: string;
  email?: string;
  role?: string;
  account_type?: string;
  business_name?: string;
  status?: string;
  profile_photo?: string | null;
  mobile_number?: string | null;
  [key: string]: unknown;
} | null;

type SessionState = {
  hydrated: boolean;
  token: string | null;
  user: SessionUser;
  role: SessionRole;
};

type SessionContextValue = SessionState & {
  signIn: (token: string, user: SessionUser, role: SessionRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (next: SessionUser) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const STORED_ROLE_KEY_PREFIX = '__role__:';

function deriveRole(user: SessionUser, fallback: SessionRole = null): SessionRole {
  if (!user || typeof user !== 'object') return fallback;
  if (typeof user.business_name === 'string' && user.business_name) return 'seller';
  if (user.role === 'seller') return 'seller';
  if (user.role === 'customer' || user.role === 'admin' || user.account_type) return 'customer';
  return fallback;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({
    hydrated: false,
    token: null,
    user: null,
    role: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user] = await Promise.all([getAuthToken(), getAuthUser<SessionUser>()]);
      if (cancelled) return;
      setState({
        hydrated: true,
        token: token ?? null,
        user: user ?? null,
        role: deriveRole(user ?? null),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (token: string, user: SessionUser, role: SessionRole) => {
    await setAuthSession(token, user);
    setState({ hydrated: true, token, user, role: role ?? deriveRole(user) });
  }, []);

  const signOut = useCallback(async () => {
    await clearAuthSession();
    setState({ hydrated: true, token: null, user: null, role: null });
  }, []);

  const refreshUser = useCallback(async (next: SessionUser) => {
    setState((prev) => {
      const role = deriveRole(next, prev.role);
      return { ...prev, user: next, role };
    });
    if (next) {
      const token = await getAuthToken();
      if (token) await setAuthSession(token, next);
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, signIn, signOut, refreshUser }),
    [state, signIn, signOut, refreshUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}

// Suppress unused-import error if storage moves
export { STORED_ROLE_KEY_PREFIX };
