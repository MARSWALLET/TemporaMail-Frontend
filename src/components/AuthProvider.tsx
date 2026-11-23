'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, type PlanEntitlements, type UserProfile } from '@/lib/api';

interface AuthContextValue {
  readonly user: UserProfile | null;
  readonly entitlements: PlanEntitlements | null;
  readonly loading: boolean;
  readonly refresh: () => Promise<void>;
  readonly logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  entitlements: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [entitlements, setEntitlements] = useState<PlanEntitlements | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getMe();
      setUser(data.user);
      setEntitlements(data.entitlements);
    } catch {
      setUser(null);
      setEntitlements(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local state even if session already expired
    }
    setUser(null);
    setEntitlements(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, entitlements, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
