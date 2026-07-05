import { api } from './api';
import type { Profile } from '../types';
import { ApiError } from './api/client';

export interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  fallbackAvailable?: boolean;
  needsRoleSelection?: boolean;
  sessionId?: string;
  uid?: string;
  user?: Profile;
  message?: string;
}

function extractApiError(error: unknown): {
  message: string;
  errorCode?: string;
  fallbackAvailable?: boolean;
} {
  if (error instanceof ApiError && error.body && typeof error.body === 'object') {
    const body = error.body as {
      message?: string | { message?: string; errorCode?: string; fallbackAvailable?: boolean };
      errorCode?: string;
      fallbackAvailable?: boolean;
    };

    if (body.message && typeof body.message === 'object') {
      return {
        message: body.message.message || 'Xatolik yuz berdi',
        errorCode: body.message.errorCode,
        fallbackAvailable: body.message.fallbackAvailable,
      };
    }

    if (typeof body.message === 'string') {
      return {
        message: body.message,
        errorCode: body.errorCode,
        fallbackAvailable: body.fallbackAvailable,
      };
    }
  }

  if (error instanceof Error) return { message: error.message };
  return { message: "Noma'lum xatolik" };
}

export const authService = {
  async requestOTPForRegistration(data: {
    phoneOrEmail: string;
    fullName: string;
    role: 'worker' | 'employer';
    channel?: 'sms' | 'email';
  }): Promise<AuthResult> {
    try {
      const res = await api.auth.requestOtp(
        data.phoneOrEmail,
        'register',
        data.fullName,
        data.role,
        data.channel,
      );
      return {
        success: true,
        sessionId: res.sessionId,
        message: res.message || 'OTP kodi SMS orqali yuborildi, telefoningizni tekshiring',
      };
    } catch (e) {
      const err = extractApiError(e);
      return {
        success: false,
        error: err.message,
        errorCode: err.errorCode,
        fallbackAvailable: err.fallbackAvailable,
      };
    }
  },

  async verifyOTPForRegistration(sessionId: string, otp: string): Promise<AuthResult> {
    try {
      await api.auth.verifyOtp(sessionId, otp);
      return { success: true };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message, errorCode: err.errorCode, fallbackAvailable: err.fallbackAvailable };
    }
  },

  async completeRegistrationWithOTP(
    sessionId: string,
    additionalData?: { email?: string; phoneNumber?: string },
  ): Promise<AuthResult> {
    try {
      const res = await api.auth.completeRegistration(sessionId, additionalData);
      return { success: true, user: res.user, uid: res.user.uid };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message };
    }
  },

  async requestOTPForLogin(
    phoneOrEmail: string,
    channel?: 'sms' | 'email',
  ): Promise<AuthResult> {
    try {
      const res = await api.auth.requestOtp(phoneOrEmail, 'login', undefined, undefined, channel);
      return {
        success: true,
        sessionId: res.sessionId,
        message: res.message || 'OTP kodi SMS orqali yuborildi, telefoningizni tekshiring',
      };
    } catch (e) {
      const err = extractApiError(e);
      return {
        success: false,
        error: err.message,
        errorCode: err.errorCode,
        fallbackAvailable: err.fallbackAvailable,
      };
    }
  },

  async verifyOTPForLogin(sessionId: string, otp: string): Promise<AuthResult> {
    try {
      await api.auth.verifyOtp(sessionId, otp);
      return { success: true };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message, errorCode: err.errorCode, fallbackAvailable: err.fallbackAvailable };
    }
  },

  async completeLoginWithOTP(sessionId: string): Promise<AuthResult> {
    try {
      const res = await api.auth.completeLogin(sessionId);
      return { success: true, user: res.user, uid: res.user.uid };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message };
    }
  },

  async createProfileWithRole(
    _user: unknown,
    role: 'worker' | 'employer',
    fullName?: string,
  ): Promise<AuthResult> {
    try {
      const profile = await api.auth.me();
      await api.users.update(profile.uid, { role, ...(fullName ? { fullName } : {}) });
      return { success: true };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message };
    }
  },

  async superAdminSignIn(email: string, password: string): Promise<AuthResult> {
    try {
      await api.auth.superAdminLogin(email, password);
      return { success: true };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message };
    }
  },
};
