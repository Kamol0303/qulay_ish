import { debugLogger } from '../lib/debugLogger';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Profile } from '../types';
import {
  clearTwoFactorVerification,
  isTwoFactorEnabled,
  isTwoFactorVerifiedForUser,
} from '../lib/twoFactorStorage';

const debugWarn = (label: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.warn(`[${label}]`, data);
  }
};

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

type UserRole = 'worker' | 'employer' | 'admin' | 'super_admin';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  userRole: UserRole | null;
  isDemo: boolean;
  requiresTwoFactor: boolean;
  isTwoFactorVerified: boolean;
  refreshProfile: () => Promise<void>;
  checkDemoSession: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileListenerActiveRef = useRef(false);
  const unsubscribeProfileRef = useRef<(() => void) | null>(null);

  const userRole = useMemo(
    () => (profile?.role as UserRole | null) || null,
    [profile]
  );

  const isDemo = useMemo(
    () => !!(user?.uid?.startsWith('demo_') || profile?.uid?.startsWith('demo_') || localStorage.getItem('qulay_ish_demo_session')),
    [user, profile]
  );

  const requiresTwoFactor = useMemo(
    () => !isDemo && isTwoFactorEnabled(profile),
    [isDemo, profile]
  );

  const isTwoFactorVerified = useMemo(
    () => !requiresTwoFactor || isTwoFactorVerifiedForUser(user?.uid),
    [requiresTwoFactor, user?.uid]
  );

  const checkDemoSession = useCallback(() => {
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (savedDemo) {
      try {
        const demoUser = JSON.parse(savedDemo);
        const demoProfile: Profile = {
          uid: demoUser.uid,
          fullName: demoUser.fullName,
          email: demoUser.email,
          phoneNumber: demoUser.phoneNumber,
          role: demoUser.role,
          region: 'Samarqand',
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

        setUser({
          uid: demoUser.uid,
          email: demoUser.email,
          displayName: demoUser.fullName,
          phoneNumber: demoUser.phoneNumber,
        } as User);
        setProfile(demoProfile);
        setLoading(false);
      } catch (err) {
        debugWarn('AuthContext] checkDemoSession parsing error:', err);
      }
    }
  }, []);

  useEffect(() => {
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (savedDemo) {
      checkDemoSession();
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        if (unsubscribeProfileRef.current) {
          unsubscribeProfileRef.current();
          unsubscribeProfileRef.current = null;
        }
        profileListenerActiveRef.current = false;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      attachProfileListener(firebaseUser.uid);
    });

    return () => unsubscribeAuth();
  }, [checkDemoSession]);

  function attachProfileListener(uid: string) {
    if (unsubscribeProfileRef.current) {
      unsubscribeProfileRef.current();
      unsubscribeProfileRef.current = null;
    }

    profileListenerActiveRef.current = true;
    setLoading(true);

    const profileRef = doc(db, 'profiles', uid);

    const timeoutId = setTimeout(() => {
      if (profileListenerActiveRef.current) {
        debugWarn('Auth] Profile load timeout for uid:', uid);
        setLoading(false);
      }
    }, 8000);

    const unsub = onSnapshot(
      profileRef,
      (snap) => {
        if (!profileListenerActiveRef.current) return;
        clearTimeout(timeoutId);
        if (snap.exists()) {
          setProfile(snap.data() as Profile);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      (err) => {
        debugError('Auth] Profile snapshot error:', err);
        clearTimeout(timeoutId);
        setProfile(null);
        setLoading(false);
      }
    );

    unsubscribeProfileRef.current = () => {
      profileListenerActiveRef.current = false;
      clearTimeout(timeoutId);
      unsub();
    };
  }

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'profiles', currentUser.uid));
      if (snap.exists()) {
        setProfile(snap.data() as Profile);
      }
    } catch (err) {
      debugError('Auth] refreshProfile error:', err);
    }
  }, []);

  const signOut = async () => {
    if (unsubscribeProfileRef.current) {
      unsubscribeProfileRef.current();
      unsubscribeProfileRef.current = null;
    }
    profileListenerActiveRef.current = false;

    localStorage.removeItem('qulay_ish_demo_session');
    clearTwoFactorVerification();

    try {
      await firebaseSignOut(auth);
    } catch (err) {
      debugWarn('Auth] Firebase signOut error (may already be signed out):', err);
    }

    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        userRole,
        isDemo,
        requiresTwoFactor,
        isTwoFactorVerified,
        refreshProfile,
        checkDemoSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
