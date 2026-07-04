import { api } from './api';
import type { Profile } from '../types';

export interface AuthResult {
  success: boolean;
  error?: string;
  needsRoleSelection?: boolean;
  sessionId?: string;
  uid?: string;
  user?: Profile;
}

function mapApiError(error: unknown): string {
  if (error && typeof error === 'object' && 'body' in error) {
    const body = (error as { body?: { message?: string | string[] } }).body;
    const msg = body?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  if (error instanceof Error) return error.message;
  return "Noma'lum xatolik";
}

export const authService = {
  async requestOTPForRegistration(data: {
    phoneOrEmail: string;
    fullName: string;
    role: 'worker' | 'employer';
  }): Promise<AuthResult & { sessionId?: string }> {
    try {
      const res = await api.auth.requestOtp(data.phoneOrEmail, 'register', data.fullName, data.role);
      return { success: true, sessionId: res.sessionId };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async verifyOTPForRegistration(sessionId: string, otp: string): Promise<AuthResult> {
    try {
      await api.auth.verifyOtp(sessionId, otp);
      return { success: true };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
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
      return { success: false, error: mapApiError(e) };
    }
  },

  async requestOTPForLogin(phoneOrEmail: string): Promise<AuthResult & { sessionId?: string }> {
    try {
      const res = await api.auth.requestOtp(phoneOrEmail, 'login');
      return { success: true, sessionId: res.sessionId };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async verifyOTPForLogin(sessionId: string, otp: string): Promise<AuthResult & { uid?: string }> {
    try {
      await api.auth.verifyOtp(sessionId, otp);
      return { success: true };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },

  async completeLoginWithOTP(sessionId: string): Promise<AuthResult> {
    try {
      const res = await api.auth.completeLogin(sessionId);
      return { success: true, user: res.user, uid: res.user.uid };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
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
      return { success: false, error: mapApiError(e) };
    }
  },

  async superAdminSignIn(email: string, password: string): Promise<AuthResult> {
    try {
      await api.auth.superAdminLogin(email, password);
      return { success: true };
    } catch (e) {
      return { success: false, error: mapApiError(e) };
    }
  },
};
