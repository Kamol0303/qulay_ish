import { debugLogger } from '../lib/debugLogger';
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Profile } from '../types';
import { api } from '../lib/api';
import { getAccessToken } from '../lib/api/client';

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
  isDemo: boolean;
  refreshProfile: () => Promise<void>;
  checkDemoSession: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const userRole = useMemo(() => (profile?.role as UserRole | null) || null, [profile]);

  const isDemo = useMemo(
    () => !!(user?.uid?.startsWith('demo_') || profile?.uid?.startsWith('demo_') || localStorage.getItem('qulay_ish_demo_session')),
    [user, profile]
  );

  const setSession = useCallback((p: Profile) => {
    setProfile(p);
    setUser({
      uid: p.uid,
      email: p.email,
      displayName: p.fullName,
      phoneNumber: p.phoneNumber,
    });
  }, []);

  const checkDemoSession = useCallback(() => {
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (!savedDemo) return;
    try {
      const demoUser = JSON.parse(savedDemo);
      const demoProfile: Profile = {
        uid: demoUser.uid,
        fullName: demoUser.fullName,
        email: demoUser.email,
        phoneNumber: demoUser.phoneNumber,
        role: demoUser.role,
        region: 'Samarqand viloyati',
        district: '',
        neighborhood: '',
        isVerified: true,
        verificationStatus: 'verified',
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
        createdAt: new Date(demoUser.createdAt).toISOString(),
        lastActive: new Date().toISOString(),
      };
      setSession(demoProfile);
      setLoading(false);
    } catch (err) {
      if (import.meta.env.DEV) debugLogger.warn('[AuthContext] demo parse error', err);
    }
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
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (savedDemo) {
      checkDemoSession();
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.auth
      .me()
      .then((p) => {
        setSession(p);
      })
      .catch(() => {
        api.auth.logout();
        setUser(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [checkDemoSession, setSession]);

  const signOut = async () => {
    localStorage.removeItem('qulay_ish_demo_session');
    localStorage.removeItem('qulay_ish_otp_login_uid');
    localStorage.removeItem('qulay_ish_otp_login_profile');
    api.auth.logout();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, userRole, isDemo, refreshProfile, checkDemoSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
