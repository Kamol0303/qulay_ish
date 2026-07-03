import { debugLogger } from './debugLogger';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { demoStore } from './demoStore';
import { passwordService } from './passwordService';
import { twoFactorService } from './twoFactorService';

export interface AuthResult {
  success: boolean;
  error?: string;
  needsRoleSelection?: boolean;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role: 'worker' | 'employer' | 'admin' | 'super_admin';
  region: string;
  district?: string;
  neighborhood?: string;
  bio?: string;
  skills?: string[];
  isVerified?: boolean;
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  createdAt?: any;
  updatedAt?: any;
  lastActive?: any;
}

const EMAIL_STORAGE_KEY = 'qulayish_email_for_signin';
const NAME_STORAGE_KEY = 'qulayish_name_for_signin';

// Debug logger - only in development
const debugLog = (label: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.log(`[${label}]`, data);
  }
};

const debugError = (label: string, error?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.error(`[${label}]`, error);
  }
};

const debugWarn = (label: string, data?: unknown) => {
  if (import.meta.env.DEV) {
    debugLogger.warn(`[${label}]`, data);
  }
};

declare global {
  interface Window {
    grecaptcha?: {
      reset: (widgetId?: number) => void;
    };
  }
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('998')) {
    return `+${digits}`;
  }

  if (digits.startsWith('9') && digits.length === 9) {
    return `+998${digits}`;
  }

  if (digits.startsWith('8') && digits.length === 12) {
    return `+9${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}

function mapFirebaseError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const message = (error as { message?: string })?.message ?? '';

  debugError('Auth Error', { code, message, error });

  switch (code) {
    case 'auth/operation-not-allowed':
      return "Autentifikatsiya usuli yoqilmagan. Administrator bilan bog'laning.";
    case 'auth/popup-closed-by-user':
      return 'Google oynasi yopib yuborildi.';
    case 'auth/popup-blocked':
      return 'Brauzer popup oynani blokladi.';
    case 'auth/unauthorized-domain':
      return "Domain ruxsat etilmagan. Firebase Console da localhost ni authorized domains ga qo'shing.";
    case 'auth/invalid-email':
      return "Email manzili noto'g'ri.";
    case 'auth/email-already-in-use':
      return "Bu email allaqachon ro'yxatdan o'tgan.";
    case 'auth/weak-password':
      return 'Parol juda oson. Kamida 6 ta belgi kiriting.';
    case 'auth/user-not-found':
      return "Foydalanuvchi topilmadi.";
    case 'auth/wrong-password':
      return "Parol noto'g'ri.";
    case 'auth/invalid-credential':
      return "Email yoki parol noto'g'ri. Qayta urinib ko'ring.";
    case 'auth/user-disabled':
      return 'Bu akkaunt bloklangan.';
    case 'auth/argument-error':
      return "Autentifikatsiya parametrlari noto'g'ri.";
    case 'auth/network-request-failed':
      return "Tarmoq xatosi. Internetni tekshiring.";
    case 'auth/invalid-app-credential':
      return "Firebase sozlamalari noto'g'ri.";
    case 'auth/internal-error':
      return "Firebase xatosi. Keyinroq qayta urinib ko'ring.";
    default:
      return message || "Autentifikatsiya xatosi. Qayta urinib ko'ring.";
  }
}

export async function checkProfileExists(uid: string): Promise<boolean> {
  const profileRef = doc(db, 'profiles', uid);
  const profileSnap = await getDoc(profileRef);
  return profileSnap.exists();
}

export async function createProfileWithRole(
  user: User,
  role: 'worker' | 'employer',
  fullName?: string
): Promise<void> {
  const profileRef = doc(db, 'profiles', user.uid);

  // Don't overwrite an existing profile
  const existing = await getDoc(profileRef);
  if (existing.exists()) {
    await setDoc(profileRef, { updatedAt: serverTimestamp(), lastActive: serverTimestamp() }, { merge: true });
    return;
  }

  const resolvedFullName =
    fullName?.trim() ||
    user.displayName ||
    user.phoneNumber ||
    user.email?.split('@')[0] ||
    'Foydalanuvchi';

  await setDoc(profileRef, {
    uid: user.uid,
    fullName: resolvedFullName,
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    role,
    region: 'Samarqand',
    district: '',
    neighborhood: '',
    bio: '',
    skills: [],
    isVerified: false,
    verificationStatus: 'pending',
    status: 'active',
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  });

  // Mirror to localStorage so Super Admin can see this user even in demo mode
  demoStore.upsertUser({
    uid: user.uid,
    fullName: resolvedFullName,
    email: user.email || '',
    phoneNumber: user.phoneNumber || '',
    role,
    region: 'Samarqand',
    isVerified: false,
    verificationStatus: 'pending',
    status: 'active',
    createdAt: new Date().toISOString(),
  });
}

async function updateExistingProfile(user: User): Promise<void> {
  const profileRef = doc(db, 'profiles', user.uid);
  await setDoc(
    profileRef,
    {
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      updatedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    },
    { merge: true }
  );
}

export const authService = {
  normalizePhoneNumber,
  checkProfileExists,
  createProfileWithRole,

  async sendEmailLink(email: string, fullName: string): Promise<AuthResult> {
    try {
      const actionCodeSettings = {
        url: `${window.location.origin}/auth`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);

      window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
      window.localStorage.setItem(NAME_STORAGE_KEY, fullName.trim());

      return { success: true };
    } catch (error) {
      debugError('Email Auth Send Error', error);

      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  async completeEmailLinkSignIn(currentUrl: string): Promise<AuthResult> {
    try {
      if (!isSignInWithEmailLink(auth, currentUrl)) {
        return { success: false, error: 'Bu email kirish linki emas.' };
      }

      const email = window.localStorage.getItem(EMAIL_STORAGE_KEY);
      const fullName = window.localStorage.getItem(NAME_STORAGE_KEY) || '';

      if (!email) {
        return {
          success: false,
          error: "Email topilmadi. Linkni o'sha qurilmada oching yoki qayta yuboring.",
        };
      }

      const result = await signInWithEmailLink(auth, email, currentUrl);
      
      const profileExists = await checkProfileExists(result.user.uid);

      window.localStorage.removeItem(EMAIL_STORAGE_KEY);
      window.localStorage.removeItem(NAME_STORAGE_KEY);

      if (!profileExists) {
        return { success: true, needsRoleSelection: true };
      }

      await updateExistingProfile(result.user);
      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Email Link Sign In Error]', error);

      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  // ========================
  // DEMO SIGN IN - COMMENTED OUT FOR PRODUCTION
  // Uncomment for testing purposes
  // ========================
  /*
  async demoSignIn(role: string): Promise<AuthResult> {
    try {
      const demoUserMap: Record<string, { email: string; password: string; fullName: string }> = {
        worker: { email: 'worker@test.com', password: '123456', fullName: 'Demo Worker' },
        employer: { email: 'employer@test.com', password: '123456', fullName: 'Demo Employer' },
        admin: { email: 'admin@test.com', password: '123456', fullName: 'Demo Admin' },
        super_admin: { email: 'superadmin@test.com', password: '123456', fullName: 'Demo Super Admin' },
      };

      const normalizedRole = role
        .toLowerCase()
        .replace('super admin', 'super_admin')
        .replace(/\s+/g, '_') as 'worker' | 'employer' | 'admin' | 'super_admin';

      const credentials = demoUserMap[normalizedRole];

      if (!credentials) {
        throw new Error(`Unknown demo role: ${role}`);
      }

      let result;
      try {
        result = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      } catch (signInError: any) {
        // Account mavjud emas — yangi yaratamiz
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          result = await createUserWithEmailAndPassword(auth, credentials.email, credentials.password);
        } else {
          throw signInError;
        }
      }

      if (result.user) {
        const profileExists = await checkProfileExists(result.user.uid);

        if (!profileExists) {
          await setDoc(doc(db, 'profiles', result.user.uid), {
            uid: result.user.uid,
            fullName: credentials.fullName,
            email: credentials.email,
            phoneNumber: '',
            role: normalizedRole,
            region: 'Samarqand',
            district: '',
            neighborhood: '',
            bio: '',
            skills: [],
            isVerified: true,
            verificationStatus: 'verified',
            rating: 0,
            reviewCount: 0,
            completedJobs: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          });
        } else {
          await updateExistingProfile(result.user);
        }
      }

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Demo Auth Error]', error);

      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },
  */

  async superAdminSignIn(phoneNumber: string, password: string): Promise<AuthResult> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const verifyPassword = httpsCallable(functions, 'verifyPasswordServerSide');
      const result = await verifyPassword({
        phoneNumber: normalizePhoneNumber(phoneNumber),
        password,
      });
      const payload = result.data as { customToken: string; uid: string };

      await signInWithCustomToken(auth, payload.customToken);

      const profileRef = doc(db, 'profiles', payload.uid);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists() || profileSnap.data()?.role !== 'super_admin') {
        await auth.signOut();
        return {
          success: false,
          error: 'Kirish rad etildi. Faqat Super Admin hisobi bilan kirishingiz mumkin.',
        };
      }

      try {
        const setClaim = httpsCallable(functions, 'setSuperAdminClaim');
        await setClaim({ targetUid: payload.uid });
      } catch (claimError) {
        debugWarn('Super Admin claim sync warning', claimError);
      }

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Super Admin Auth Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  async signInWithGoogle(): Promise<AuthResult> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const profileExists = await checkProfileExists(result.user.uid);

      if (!profileExists) {
        return { success: true, needsRoleSelection: true };
      }

      await updateExistingProfile(result.user);
      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Google Auth Error]', error);

      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  async registerWithPassword(data: {
    phoneNumber: string;
    email: string;
    fullName: string;
    password: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult> {
    try {
      const normalizedPhone = normalizePhoneNumber(data.phoneNumber);
      const passwordValidation = passwordService.validatePassword(data.password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.error };
      }

      const profilesRef = collection(db, 'profiles');
      const phoneQuery = query(profilesRef, where('phoneNumber', '==', normalizedPhone));
      const phoneSnap = await getDocs(phoneQuery);
      if (!phoneSnap.empty) {
        return { success: false, error: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan' };
      }

      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const profileRef = doc(db, 'profiles', userCredential.user.uid);
      await setDoc(profileRef, {
        uid: userCredential.user.uid,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: normalizedPhone,
        role: data.role,
        region: 'Samarqand',
        district: '',
        neighborhood: '',
        bio: '',
        skills: [],
        isVerified: false,
        verificationStatus: 'pending',
        status: 'active',
        twoFactorEnabled: false,
        rating: 0,
        reviewCount: 0,
        completedJobs: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      });

      if (functions) {
        const storeCredentials = httpsCallable(functions, 'storePasswordCredentials');
        await storeCredentials({ password: data.password });
      }

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Register Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  async loginWithPassword(data: { phoneNumber: string; password: string }): Promise<AuthResult> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const verifyPassword = httpsCallable(functions, 'verifyPasswordServerSide');
      const result = await verifyPassword({
        phoneNumber: normalizePhoneNumber(data.phoneNumber),
        password: data.password,
      });
      const payload = result.data as { customToken: string };
      await signInWithCustomToken(auth, payload.customToken);
      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Login Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  async startTwoFactorEnrollment(): Promise<AuthResult & {
    qrCodeDataUrl?: string;
    manualEntryKey?: string;
  }> {
    const result = await twoFactorService.initiateSetup();
    if (!result.success) return { success: false, error: result.error };
    return {
      success: true,
      qrCodeDataUrl: result.qrCodeDataUrl,
      manualEntryKey: result.manualEntryKey,
    };
  },

  async confirmTwoFactorEnrollment(code: string): Promise<AuthResult & { backupCodes?: string[] }> {
    const result = await twoFactorService.confirmSetup(code);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, backupCodes: result.backupCodes };
  },

  async verifyTwoFactorChallenge(code: string): Promise<AuthResult & { verifiedAt?: number }> {
    const result = await twoFactorService.verifyLogin(code);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, verifiedAt: result.verifiedAt };
  },

  async verifyTwoFactorBackupCode(backupCode: string): Promise<AuthResult & { verifiedAt?: number }> {
    const result = await twoFactorService.verifyLogin(undefined, backupCode);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, verifiedAt: result.verifiedAt };
  },

  async disableTwoFactor(code: string, password?: string): Promise<AuthResult> {
    const result = await twoFactorService.disable(code, password);
    if (!result.success) return { success: false, error: result.error };
    return { success: true };
  },

  async regenerateTwoFactorBackupCodes(code: string): Promise<AuthResult & { backupCodes?: string[] }> {
    const result = await twoFactorService.regenerateBackupCodes(code);
    if (!result.success) return { success: false, error: result.error };
    return { success: true, backupCodes: result.backupCodes };
  },
};
