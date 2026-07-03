import { debugLogger } from './debugLogger';
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCustomToken,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase';
import { demoStore } from './demoStore';
import { passwordService } from './passwordService';
import { totpService } from './totpService';

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
const PHONE_SESSION_KEY = 'qulayish_phone_session';

let phoneConfirmationResult: ConfirmationResult | null = null;
let phoneConfirmationTimestamp: number | null = null;

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

  clearPhoneSession(): void {
    phoneConfirmationResult = null;
    phoneConfirmationTimestamp = null;
    sessionStorage.removeItem(PHONE_SESSION_KEY);
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

      // Check if phone already exists
      const profilesRef = collection(db, 'profiles');
      const phoneQuery = query(profilesRef, where('phoneNumber', '==', normalizedPhone));
      const phoneSnap = await getDocs(phoneQuery);

      if (!phoneSnap.empty) {
        return {
          success: false,
          error: 'Bu telefon raqam allaqachon ro\'yxatdan o\'tgan',
        };
      }

      // Hash password
      const passwordHash = await passwordService.hashPassword(data.password);

      // Create Firebase user with email
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      // Create profile with passwordHash and role
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

      // Find user by phone number
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

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        data.password
      );

      // Update last active
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

  /**
   * OTP orqali ro'yxatdan o'tish uchun OTP kodi jo'natish
   */
  async requestOTPForRegistration(data: {
    phoneOrEmail: string;
    fullName: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult & { sessionId?: string }> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const createSession = httpsCallable(functions, 'createOTPRegistrationSession');
      const result = await createSession({
        phoneOrEmail: data.phoneOrEmail.trim(),
        fullName: data.fullName.trim(),
        role: data.role,
      });
      const payload = result.data as { success: boolean; sessionId: string };

      return { success: true, sessionId: payload.sessionId };
    } catch (error) {
      debugError('OTP Request Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  /**
   * OTP orqali ro'yxatdan o'tish uchun OTP ni tasdiqlash
   */
  async verifyOTPForRegistration(sessionId: string, otp: string): Promise<AuthResult> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const verifySession = httpsCallable(functions, 'verifyOTPSession');
      await verifySession({ sessionId, otp });

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('OTP Verify Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  /**
   * OTP verified sessiyadan user yaratish va kirish
   */
  async completeRegistrationWithOTP(sessionId: string, additionalData?: {
    email?: string;
    phoneNumber?: string;
  }): Promise<AuthResult> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const completeRegistration = httpsCallable(functions, 'completeOTPRegistration');
      const result = await completeRegistration({
        sessionId,
        email: additionalData?.email,
        phoneNumber: additionalData?.phoneNumber,
      });
      const payload = result.data as { customToken: string };

      await signInWithCustomToken(auth, payload.customToken);
      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('OTP Completion Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  /**
   * OTP orqali kirish uchun OTP kodi jo'natish
   */
  async requestOTPForLogin(phoneOrEmail: string): Promise<AuthResult & { sessionId?: string }> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const createSession = httpsCallable(functions, 'createOTPLoginSession');
      const result = await createSession({ phoneOrEmail: phoneOrEmail.trim() });
      const payload = result.data as { success: boolean; sessionId: string };

      return { success: true, sessionId: payload.sessionId };
    } catch (error) {
      debugError('OTP Login Request Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  /**
   * OTP orqali kirish uchun OTP ni tasdiqlash
   */
  async verifyOTPForLogin(sessionId: string, otp: string): Promise<AuthResult & { uid?: string }> {
    try {
      if (!functions) {
        return { success: false, error: 'Cloud Functions mavjud emas.' };
      }

      const verifySession = httpsCallable(functions, 'verifyOTPSession');
      await verifySession({ sessionId, otp });

      return { success: true, needsRoleSelection: false };
    } catch (error) {
      debugError('OTP Login Verify Error]', error);
      return { success: false, error: mapFirebaseError(error) };
    }
  },

  /**
   * OTP verified sessiyadan foydalanuvchi kiritish
   */
  async completeLoginWithOTP(sessionId: string): Promise<AuthResult> {
    try {
      const otpRef = doc(db, 'otp_sessions', sessionId);
      const otpSnap = await getDoc(otpRef);

      if (!otpSnap.exists() || !otpSnap.data().verified) {
        return {
          success: false,
          error: 'OTP tasdiqlash muvaffaqiyatsiz. Qayta urinib ko\'ring.',
        };
      }

      // Call Cloud Function to get custom token
      try {
        if (functions) {
          const createOTPLoginToken = httpsCallable(functions, 'createOTPLoginToken');
          const result = await createOTPLoginToken({sessionId});
          const tokenData = result.data as { customToken: string };
          const customToken = tokenData.customToken;

          // Sign in with custom token
          await signInWithCustomToken(auth, customToken);

          return { success: true, needsRoleSelection: false };
        } else {
          // Fallback for development without functions
          const otpData = otpSnap.data();
          const uid = otpData.uid;

          // Get user profile
          const profileRef = doc(db, 'profiles', uid);
          const profileSnap = await getDoc(profileRef);

          if (!profileSnap.exists()) {
            return {
              success: false,
              error: 'Foydalanuvchi profili topilmadi.',
            };
          }

          // Update last active
          await setDoc(profileRef, { 
            updatedAt: serverTimestamp(), 
            lastActive: serverTimestamp() 
          }, { merge: true });

          // Mark OTP session as completed
          await setDoc(otpRef, { completed: true, completedAt: serverTimestamp() }, { merge: true });

          // Store OTP login session for demo mode
          localStorage.setItem('qulay_ish_otp_login_uid', uid);
          localStorage.setItem('qulay_ish_otp_login_profile', JSON.stringify(profileSnap.data()));

          return { success: true, needsRoleSelection: false };
        }
      } catch (tokenError: any) {
        debugWarn('OTP Token Error]', tokenError);
        
        // Fallback: Use local session storage
        const otpData = otpSnap.data();
        const uid = otpData.uid;

        // Get user profile
        const profileRef = doc(db, 'profiles', uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
          return {
            success: false,
            error: 'Foydalanuvchi profili topilmadi.',
          };
        }

        // Update last active
        await setDoc(profileRef, { 
          updatedAt: serverTimestamp(), 
          lastActive: serverTimestamp() 
        }, { merge: true });

        // Mark OTP session as completed
        await setDoc(otpRef, { completed: true, completedAt: serverTimestamp() }, { merge: true });

        // Store OTP login session
        localStorage.setItem('qulay_ish_otp_login_uid', uid);
        localStorage.setItem('qulay_ish_otp_login_profile', JSON.stringify(profileSnap.data()));

        return { success: true, needsRoleSelection: false };
      }
    } catch (error: any) {
      debugError('OTP Login Completion Error]', error);
      return {
        success: false,
        error: mapFirebaseError(error),
      };
    }
  },

  /**
   * Optional 2FA: start enrollment (authenticated user).
   */
  async startTwoFactorEnrollment(): Promise<AuthResult & {
    sessionId?: string;
    qrCodeDataUrl?: string;
    backupCodes?: string[];
  }> {
    const result = await totpService.startEnrollment();
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      sessionId: result.sessionId,
      qrCodeDataUrl: result.qrCodeDataUrl,
      backupCodes: result.backupCodes,
    };
  },

  async confirmTwoFactorEnrollment(sessionId: string, code: string): Promise<AuthResult> {
    const result = await totpService.confirmEnrollment(sessionId, code);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, needsRoleSelection: false };
  },

  async verifyTwoFactorChallenge(code: string): Promise<AuthResult & { verifiedAt?: number }> {
    const result = await totpService.verifyChallenge(code);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, needsRoleSelection: false, verifiedAt: result.verifiedAt };
  },

  async verifyTwoFactorBackupCode(backupCode: string): Promise<AuthResult & {
    remainingBackupCodes?: number;
    verifiedAt?: number;
  }> {
    const result = await totpService.useBackupCode(backupCode);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return {
      success: true,
      needsRoleSelection: false,
      remainingBackupCodes: result.remainingBackupCodes,
      verifiedAt: result.verifiedAt,
    };
  },

  async disableTwoFactor(code: string): Promise<AuthResult> {
    const result = await totpService.disable(code);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, needsRoleSelection: false };
  },
};
