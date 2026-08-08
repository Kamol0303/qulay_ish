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
  resetAllowed?: boolean;
  purpose?: string;
}

function mapApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as { remainingAttempts?: number; message?: string } | undefined;
    const remaining = body?.remainingAttempts;
    if (typeof remaining === 'number' && remaining > 0) {
      return `${error.message} (${remaining} ta urinish qoldi)`;
    }
    if (!error.status || error.message.toLowerCase().includes('failed to fetch')) {
      return 'Serverga ulanib bo‘lmadi. Internetni tekshiring.';
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'Serverga ulanib bo‘lmadi. Internetni tekshiring.';
    }
    return error.message;
  }
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

  async loginWithPassword(phone: string, password: string): Promise<AuthResult> {
    try {
      const res = await api.auth.login(normalizePhoneNumber(phone), password);
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

  async registerWithPassword(params: {
    phone: string;
    password: string;
    fullName: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult> {
    try {
      const res = await api.auth.register({
        phone: normalizePhoneNumber(params.phone),
        password: params.password,
        fullName: params.fullName.trim(),
        role: params.role,
      });
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

  async sendOtp(params: {
    phone: string;
    purpose?: 'login' | 'register' | 'reset';
    fullName?: string;
    role?: 'worker' | 'employer';
    password?: string;
  }): Promise<AuthResult> {
    try {
      const phone = normalizePhoneNumber(params.phone);
      await api.auth.sendOtp({
        phone,
        purpose: params.purpose,
        fullName: params.fullName,
        role: params.role,
        password: params.password,
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async verifyOtp(phone: string, code: string): Promise<AuthResult> {
    try {
      const res = await api.auth.verifyOtp(normalizePhoneNumber(phone), code);
      if (res.resetAllowed || res.purpose === 'reset') {
        return { success: true, resetAllowed: true, purpose: 'reset' };
      }
      if (!res.user) {
        return { success: false, error: 'Autentifikatsiya javobi noto\'g\'ri' };
      }
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

  async resetPassword(phone: string, newPassword: string): Promise<AuthResult> {
    try {
      await api.auth.resetPassword(normalizePhoneNumber(phone), newPassword);
      return { success: true };
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
