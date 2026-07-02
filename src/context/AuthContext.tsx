import { debugLogger } from '../lib/debugLogger';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { Profile } from '../types';

// Debug logger - only in development
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
  /** Call after profile is written to Firestore to force a fresh read */
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

  const checkOTPLoginSession = useCallback(async () => {
    const otpLoginUid = localStorage.getItem('qulay_ish_otp_login_uid');
    const otpLoginProfile = localStorage.getItem('qulay_ish_otp_login_profile');
    
    if (otpLoginUid && otpLoginProfile) {
      try {
        const profile = JSON.parse(otpLoginProfile);
        
        // Create a pseudo-user object for OTP login
        setUser({
          uid: otpLoginUid,
          email: profile.email || '',
          displayName: profile.fullName || '',
          phoneNumber: profile.phoneNumber || '',
          emailVerified: true,
          isAnonymous: false,
          metadata: {},
          providerData: [],
          reload: async () => {},
          getIdToken: async () => '',
          getIdTokenResult: async () => ({} as any),
          delete: async () => {},
          toJSON: () => ({}),
        } as any);
        
        setProfile(profile);
        setLoading(false);
        return true;
      } catch (err) {
        debugWarn('AuthContext] checkOTPLoginSession parsing error:', err);
        localStorage.removeItem('qulay_ish_otp_login_uid');
        localStorage.removeItem('qulay_ish_otp_login_profile');
      }
    }
    return false;
  }, []);

  // Restore auth state on mount
  useEffect(() => {
    const savedDemo = localStorage.getItem('qulay_ish_demo_session');
    if (savedDemo) {
      checkDemoSession();
      return;
    }

    // Check for OTP login session
    const checkOTPSession = async () => {
      const isOTPLogin = await checkOTPLoginSession();
      if (isOTPLogin) {
        return;
      }

      // Otherwise, use Firebase Auth
      const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (!firebaseUser) {
          // Tear down profile listener
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

        // New user signed in — keep loading=true, attach profile listener
        setUser(firebaseUser);
        attachProfileListener(firebaseUser.uid);
      });

      return () => unsubscribeAuth();
    };

    checkOTPSession();
  }, [checkDemoSession, checkOTPLoginSession]);

  function attachProfileListener(uid: string) {
    // Tear down any existing listener first
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

  /**
   * Force-read the profile from Firestore once.
   * Use this right after writing a new profile so the UI doesn't wait for the
   * snapshot to propagate (which can take a moment and cause a redirect loop).
   */
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

    // Clear demo session if any
    localStorage.removeItem('qulay_ish_demo_session');
    // Clear OTP login session if any
    localStorage.removeItem('qulay_ish_otp_login_uid');
    localStorage.removeItem('qulay_ish_otp_login_profile');

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
      value={{ user, profile, loading, signOut, userRole, isDemo, refreshProfile, checkDemoSession }}
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
