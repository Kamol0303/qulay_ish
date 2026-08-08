import { debugLogger } from '../lib/debugLogger';
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Profile } from '../types';
import { api } from '../lib/api';
import {
  ApiError,
  cacheSessionProfile,
  clearAccessToken,
  getAccessToken,
  isAccessTokenValid,
  readCachedSessionProfile,
} from '../lib/api/client';
import { clearLegacyDemoStorage } from '../lib/demoMode';

type UserRole = 'worker' | 'employer' | 'admin' | 'super_admin';

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
}

interface AuthContextType {
  user: AppUser | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
  /** Always false — demo/local-only auth is disabled (shared backend requirement). */
  isDemo: boolean;
  refreshProfile: () => Promise<void>;
  setAuthProfile: (profile: Profile) => void;
  checkDemoSession: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const userRole = useMemo(() => (profile?.role as UserRole | null) || null, [profile]);
  const isDemo = false;

  const setSession = useCallback((p: Profile) => {
    setProfile(p);
    setUser({
      uid: p.uid,
      email: p.email,
      displayName: p.fullName,
      phoneNumber: p.phoneNumber,
    });
    cacheSessionProfile(p);
  }, []);

  const checkDemoSession = useCallback(() => {
    clearLegacyDemoStorage();
  }, []);

  const setAuthProfile = useCallback((p: Profile) => {
    setSession(p);
    setLoading(false);
  }, [setSession]);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.auth.me();
      setSession(p);
    } catch (err) {
      if (import.meta.env.DEV) debugLogger.error('[AuthContext] refreshProfile', err);
    }
  }, [setSession]);

  useEffect(() => {
    clearLegacyDemoStorage();
    const token = getAccessToken();
    if (token) {
      if (!isAccessTokenValid(token)) {
        clearAccessToken();
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      api.auth
        .me()
        .then((p) => setSession(p))
        .catch((err) => {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            clearAccessToken();
            setUser(null);
            setProfile(null);
            return;
          }
          const cached = readCachedSessionProfile<Profile>();
          if (cached?.uid && isAccessTokenValid(token)) {
            setSession(cached);
            if (import.meta.env.DEV) {
              debugLogger.warn('[AuthContext] /auth/me failed; using cached session until API is back');
            }
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, [setSession]);

  const signOut = useCallback(async () => {
    clearLegacyDemoStorage();
    api.auth.logout();
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signOut,
      userRole,
      isDemo,
      refreshProfile,
      setAuthProfile,
      checkDemoSession,
    }),
    [user, profile, loading, signOut, userRole, isDemo, refreshProfile, setAuthProfile, checkDemoSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
