/**
 * ========================================
 * DEMO MODE AUTHENTICATION SERVICE
 * ========================================
 *
 * WARNING: This is for TESTING ONLY!
 * DELETE THIS FILE before production deployment!
 */

import { debugLogger } from './debugLogger';
import { api } from './api';

const DEMO_SESSION_KEY = 'qulay_ish_demo_session';

export interface DemoUser {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'worker' | 'employer';
  createdAt: number;
}

function generateDemoUID(role: 'worker' | 'employer' = 'worker'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const prefix = role === 'employer' ? 'demo_employer' : 'demo_worker';
  return `${prefix}_${timestamp}_${random}`;
}

function saveDemoSession(user: DemoUser): void {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  debugLogger.log('[DEMO] Session saved:', user.uid);
}

export function getDemoSession(): DemoUser | null {
  const session = localStorage.getItem(DEMO_SESSION_KEY);
  if (!session) return null;

  try {
    return JSON.parse(session) as DemoUser;
  } catch {
    return null;
  }
}

export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
  debugLogger.log('[DEMO] Session cleared');
}

export function isDemoMode(): boolean {
  return getDemoSession() !== null;
}

export async function demoRegister(data: {
  fullName: string;
  email?: string;
  phoneNumber?: string;
  role: 'worker' | 'employer';
}): Promise<{ success: boolean; error?: string; uid?: string }> {
  try {
    debugLogger.log('[DEMO] Registration started:', data.email || data.phoneNumber);

    const uid = generateDemoUID(data.role);
    debugLogger.log('[DEMO] Generated UID:', uid);

    try {
      await api.users.update(uid, {
        uid,
        fullName: data.fullName,
        email: data.email || `demo${Date.now()}@example.com`,
        phoneNumber: data.phoneNumber || '',
        role: data.role,
        region: 'Samarqand',
        district: '',
        neighborhood: '',
        bio: '',
        isVerified: false,
        verificationStatus: 'pending',
        skills: data.role === 'worker' ? [] : undefined,
      } as Parameters<typeof api.users.update>[1]);
    } catch {
      debugLogger.log('[DEMO] API profile create skipped — using local session only');
    }

    const demoUser: DemoUser = {
      uid,
      fullName: data.fullName,
      email: data.email || `demo${Date.now()}@example.com`,
      phoneNumber: data.phoneNumber || '',
      role: data.role,
      createdAt: Date.now(),
    };

    saveDemoSession(demoUser);
    return { success: true, uid };
  } catch (error: unknown) {
    debugLogger.error('[DEMO] Registration error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Demo registration error: ${message}` };
  }
}

export async function demoLogin(data: {
  phoneNumber?: string;
  email?: string;
  password?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const identifier = data.email || data.phoneNumber || 'demo';
    debugLogger.log('[DEMO] Login started:', identifier);

    const demoUser: DemoUser = {
      uid: generateDemoUID(),
      fullName: 'Demo Worker',
      email: data.email || `demo${Date.now()}@test.com`,
      phoneNumber: data.phoneNumber || '+998900000000',
      role: 'worker',
      createdAt: Date.now(),
    };

    saveDemoSession(demoUser);
    debugLogger.log('[DEMO] Login successful');
    return { success: true };
  } catch (error: unknown) {
    debugLogger.error('[DEMO] Login error:', error);
    const message = error instanceof Error ? error.message : 'Login failed';
    return { success: false, error: message };
  }
}

export function demoLogout(): void {
  clearDemoSession();
  debugLogger.log('[DEMO] Logged out');
}
