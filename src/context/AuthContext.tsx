import { debugLogger } from '../lib/debugLogger';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Profile } from '../types';
import {
  clearApiSession,
  getApiSession,
  persistApiSession,
  UserProfile,
} from '../lib/authService';

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
  refreshProfile: () => Promise<void>;
  checkDemoSession: () => void;
  establishApiSession: (accessToken: string, profile: UserProfile) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toContextProfile(profile: UserProfile): Profile {
  return {
    uid: profile.uid,
    fullName: profile.fullName,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
    role: profile.role,
    region: profile.region,
    district: profile.district,
    neighborhood: profile.neighborhood,
    bio: profile.bio,
    skills: profile.skills,
    isVerified: profile.isVerified,
    verificationStatus: profile.verificationStatus,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    completedJobs: profile.completedJobs,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    lastActive: profile.lastActive,
  };
}

function createApiPseudoUser(profile: Profile, accessToken: string): User {
  return {
    uid: profile.uid,
    email: profile.email || null,
    displayName: profile.fullName,
    phoneNumber: profile.phoneNumber || null,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    reload: async () => {},
    getIdToken: async () => accessToken,
    getIdTokenResult: async () => ({ token: accessToken } as any),
    delete: async () => {},
    toJSON: () => ({}),
  } as User;
}

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

  const establishApiSession = useCallback((accessToken: string, apiProfile: UserProfile) => {
    persistApiSession(accessToken, apiProfile);
    const nextProfile = toContextProfile(apiProfile);
    setUser(createApiPseudoUser(nextProfile, accessToken));
    setProfile(nextProfile);
    setLoading(false);
  }, []);

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

  const checkApiAuthSession = useCallback(() => {
    const session = getApiSession();
    if (!session) return false;

    const nextProfile = toContextProfile(session.profile);
    setUser(createApiPseudoUser(nextProfile, session.accessToken));
    setProfile(nextProfile);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (savedDemo) {
      checkDemoSession();
      return;
    }

    if (checkApiAuthSession()) {
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
  }, [checkDemoSession, checkApiAuthSession]);

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
    const apiSession = getApiSession();
    if (apiSession) {
      setProfile(toContextProfile(apiSession.profile));
      return;
    }

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
    clearApiSession();

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
        refreshProfile,
        checkDemoSession,
        establishApiSession,
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
