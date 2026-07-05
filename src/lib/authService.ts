import { ApiError } from './api/client';
import { api } from './api';
import type { Profile } from '../types';

export interface AuthResult {
  success: boolean;
  error?: string;
  accessToken?: string;
  profile?: Profile;
  user?: Profile;
  uid?: string;
}

function mapApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { remainingAttempts?: number; message?: string } | undefined;
    const remaining = body?.remainingAttempts;
    if (typeof remaining === 'number' && remaining > 0) {
      return `${error.message} (${remaining} ta urinish qoldi)`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Noma'lum xatolik";
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export const authService = {
  normalizePhoneNumber,

  async sendOtp(params: {
    phone: string;
    purpose?: 'login' | 'register';
    fullName?: string;
    role?: 'worker' | 'employer';
  }): Promise<AuthResult> {
    try {
      const phone = normalizePhoneNumber(params.phone);
      await api.auth.sendOtp({
        phone,
        purpose: params.purpose,
        fullName: params.fullName,
        role: params.role,
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    try {
      const res = await api.auth.verifyOtp(normalizePhoneNumber(phone), code);
      return {
        success: true,
        accessToken: res.accessToken,
        profile: res.user,
        user: res.user,
        uid: res.user.uid,
      };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async superAdminSignIn(email: string, password: string): Promise<AuthResult> {
    try {
      const res = await api.auth.superAdminLogin(email, password);
      return { success: true, user: res.user, uid: res.user.uid };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },
};
