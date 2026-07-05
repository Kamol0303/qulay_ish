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
      message?: string | string[] | { message?: string; errorCode?: string; fallbackAvailable?: boolean };
      errorCode?: string;
      fallbackAvailable?: boolean;
    };

    if (body.message && typeof body.message === 'object' && !Array.isArray(body.message)) {
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

    if (Array.isArray(body.message)) {
      return { message: body.message.join(', ') };
    }
  }

  if (error instanceof Error) return { message: error.message };
  return { message: "Noma'lum xatolik" };
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed;
  return trimmed;
}

export const authService = {
  async sendOtp(
    phoneOrEmail: string,
    opts?: {
      purpose?: 'login' | 'register';
      fullName?: string;
      role?: 'worker' | 'employer';
    },
  ): Promise<AuthResult> {
    try {
      const phone = normalizePhone(phoneOrEmail);
      await api.auth.sendOtp(phone, opts);
      return {
        success: true,
        message: 'OTP kodi SMS orqali yuborildi, telefoningizni tekshiring',
      };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message, errorCode: err.errorCode };
    }
  },

  async verifyOtp(phoneOrEmail: string, code: string): Promise<AuthResult> {
    try {
      const phone = normalizePhone(phoneOrEmail);
      const res = await api.auth.verifyOtp(phone, code);
      return { success: true, user: res.user, uid: res.user.uid };
    } catch (e) {
      const err = extractApiError(e);
      return { success: false, error: err.message, errorCode: err.errorCode };
    }
  },

  async requestOTPForRegistration(data: {
    phoneOrEmail: string;
    fullName: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult> {
    return this.sendOtp(data.phoneOrEmail, {
      purpose: 'register',
      fullName: data.fullName,
      role: data.role,
    });
  },

  async requestOTPForLogin(phoneOrEmail: string): Promise<AuthResult> {
    return this.sendOtp(phoneOrEmail, { purpose: 'login' });
  },

  async verifyOTPForRegistration(phoneOrEmail: string, otp: string): Promise<AuthResult> {
    return this.verifyOtp(phoneOrEmail, otp);
  },

  async verifyOTPForLogin(phoneOrEmail: string, otp: string): Promise<AuthResult> {
    return this.verifyOtp(phoneOrEmail, otp);
  },

  async updateProfileAfterRegistration(
    userId: string,
    data: { email?: string; fullName?: string },
  ): Promise<AuthResult> {
    try {
      await api.users.update(userId, {
        ...(data.email ? { email: data.email } : {}),
        ...(data.fullName ? { fullName: data.fullName } : {}),
      });
      const profile = await api.auth.me();
      return { success: true, user: profile };
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
