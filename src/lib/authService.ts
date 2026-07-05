import { debugLogger } from './debugLogger';
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { demoStore } from './demoStore';
import { passwordService } from './passwordService';
import { ApiError, apiFetch } from './apiClient';

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
export const API_ACCESS_TOKEN_KEY = 'qulay_ish_access_token';
export const API_PROFILE_KEY = 'qulay_ish_api_profile';

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

function mapApiUserToProfile(user: Record<string, unknown>): UserProfile {
  return {
    uid: String(user.id ?? ''),
    fullName: String(user.fullName ?? 'User'),
    email: String(user.email ?? ''),
    phoneNumber: user.phoneNumber
      ? String(user.phoneNumber)
      : user.phone
        ? String(user.phone)
        : undefined,
    role: (user.role as UserProfile['role']) ?? 'worker',
    region: String(user.region ?? 'Samarqand viloyati'),
    district: user.district ? String(user.district) : undefined,
    neighborhood: user.neighborhood ? String(user.neighborhood) : undefined,
    isVerified: Boolean(user.isVerified),
    verificationStatus: (user.verificationStatus as UserProfile['verificationStatus']) ?? 'verified',
    rating: typeof user.rating === 'number' ? user.rating : 0,
    reviewCount: typeof user.reviewCount === 'number' ? user.reviewCount : 0,
    completedJobs: typeof user.completedJobs === 'number' ? user.completedJobs : 0,
  };
}

export function persistApiSession(accessToken: string, profile: UserProfile): void {
  localStorage.setItem(API_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(API_PROFILE_KEY, JSON.stringify(profile));
}

export function clearApiSession(): void {
  localStorage.removeItem(API_ACCESS_TOKEN_KEY);
  localStorage.removeItem(API_PROFILE_KEY);
  localStorage.removeItem('qulay_ish_otp_login_uid');
  localStorage.removeItem('qulay_ish_otp_login_profile');
}

export function getApiSession(): { accessToken: string; profile: UserProfile } | null {
  const accessToken = localStorage.getItem(API_ACCESS_TOKEN_KEY);
  const rawProfile = localStorage.getItem(API_PROFILE_KEY);
  if (!accessToken || !rawProfile) return null;
  try {
    return { accessToken, profile: JSON.parse(rawProfile) as UserProfile };
  } catch {
    return null;
  }
}

function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const remaining = err.body?.remainingAttempts;
    if (typeof remaining === 'number' && remaining > 0) {
      return `${err.message} (${remaining} ta urinish qoldi)`;
    }
    return err.message;
  }
  return 'Kutilmagan xato yuz berdi. Qayta urinib ko\'ring.';
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
      return "Firebase Phone Authentication yoqilmagan. Firebase Console > Authentication > Sign-in method > Phone ni yoqing.";
    case 'auth/invalid-phone-number':
      return "Telefon raqam noto'g'ri formatda. +998XXXXXXXXX ko'rinishida kiriting.";
    case 'auth/too-many-requests':
      return "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.";
    case 'auth/quota-exceeded':
      return "SMS limiti tugagan. Keyinroq qayta urinib ko'ring.";
    case 'auth/code-expired':
      return "Tasdiqlash kodi eskirib qolgan. Yangi kod so'rang.";
    case 'auth/invalid-verification-code':
      return "Tasdiqlash kodi noto'g'ri. 6 ta raqamni to'g'ri kiriting.";
    case 'auth/missing-verification-code':
      return "Tasdiqlash kodini kiriting.";
    case 'auth/captcha-check-failed':
      return "reCAPTCHA tekshiruvi muvaffaqiyatsiz tugadi. Qayta urinib ko'ring.";
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

  async superAdminSignIn(email: string, password: string): Promise<AuthResult> {
    try {
      let result;
      try {
        result = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInError: any) {
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          // Create super admin account if doesn't exist
          result = await createUserWithEmailAndPassword(auth, email, password);
          
          // Create super admin profile
          const profileRef = doc(db, 'profiles', result.user.uid);
          await setDoc(profileRef, {
            uid: result.user.uid,
            fullName: 'Super Administrator',
            email,
            phoneNumber: '+998900707081',
            role: 'super_admin',
            region: 'Samarqand',
            district: '',
            neighborhood: '',
            bio: 'Platform Super Administrator',
            skills: [],
            isVerified: true,
            verificationStatus: 'verified',
            rating: 0,
            reviewCount: 0,
            completedJobs: 0,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          });
        } else {
          throw signInError;
        }
      }
      
      if (result.user) {
        const profileRef = doc(db, 'profiles', result.user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists() || profileSnap.data()?.role !== 'super_admin') {
          await auth.signOut();
          return {
            success: false,
            error: 'Kirish rad etildi. Faqat Super Admin hisobi bilan kirishingiz mumkin.',
          };
        }

        await updateExistingProfile(result.user);
      }

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('Super Admin Auth Error]', error);

      return {
        success: false,
        error: mapFirebaseError(error),
      };
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

  /**
   * Parol bilan ro'yxatdan o'tish
   */
  async registerWithPassword(data: {
    phoneNumber: string;
    email: string;
    fullName: string;
    password: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult> {
    try {
      const normalizedPhone = normalizePhoneNumber(data.phoneNumber);

      if (!data.role) {
        return {
          success: false,
          error: 'Iltimos, ro’yhatdan o’tishda rolni tanlang.',
        };
      }

      const profilesRef = collection(db, 'profiles');
      const phoneQuery = query(profilesRef, where('phoneNumber', '==', normalizedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (!phoneSnap.empty) {
        return {
          success: false,
          error: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan',
        };
      }

      const passwordHash = await passwordService.hashPassword(data.password);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      const profileRef = doc(db, 'profiles', userCredential.user.uid);
      await setDoc(profileRef, {
        uid: userCredential.user.uid,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: normalizedPhone,
        passwordHash,
        role: data.role,
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

      return { success: true, needsRoleSelection: false };
    } catch (error: any) {
      debugError('Register Error]', error);
      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  /**
   * Parol bilan kirish
   */
  async loginWithPassword(data: {
    phoneNumber: string;
    password: string;
  }): Promise<AuthResult> {
    try {
      const normalizedPhone = normalizePhoneNumber(data.phoneNumber);

      const profilesRef = collection(db, 'profiles');
      const phoneQuery = query(profilesRef, where('phoneNumber', '==', normalizedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (phoneSnap.empty) {
        return {
          success: false,
          error: 'Telefon raqam topilmadi',
        };
      }

      const profileData = phoneSnap.docs[0].data();
      const email = profileData.email;

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        data.password
      );

      await updateExistingProfile(userCredential.user);

      return { success: true, needsRoleSelection: false };
    } catch (error: any) {
      debugError('Login Error]', error);
      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  async sendOtp(params: {
    phone: string;
    purpose?: 'login' | 'register';
    fullName?: string;
    role?: 'worker' | 'employer';
  }): Promise<AuthResult> {
    try {
      const phone = normalizePhoneNumber(params.phone);
      await apiFetch<{ success: true }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          purpose: params.purpose,
          fullName: params.fullName,
          role: params.role,
        }),
      });
      return { success: true };
    } catch (error) {
      debugError('Send OTP Error]', error);
      return { success: false, error: formatApiError(error) };
    }
  },

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<AuthResult & { accessToken?: string; profile?: UserProfile }> {
    try {
      const result = await apiFetch<{
        success: true;
        accessToken: string;
        user: Record<string, unknown>;
      }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone: normalizePhoneNumber(phone),
          code,
        }),
      });

      const profile = mapApiUserToProfile(result.user);
      persistApiSession(result.accessToken, profile);

      return {
        success: true,
        accessToken: result.accessToken,
        profile,
      };
    } catch (error) {
      debugError('Verify OTP Error]', error);
      return { success: false, error: formatApiError(error) };
    }
  },
};
