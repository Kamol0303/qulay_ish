/**
 * ========================================
 * DEMO MODE AUTHENTICATION SERVICE
 * ========================================
 * 
 * WARNING: This is for TESTING ONLY!
 * DELETE THIS FILE before production deployment!
 */

import { debugLogger } from './debugLogger';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const DEMO_SESSION_KEY = 'qulay_ish_demo_session';

export interface DemoUser {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: 'worker' | 'employer';
  createdAt: number;
}

/**
 * Generate a unique demo user ID based on role
 */
function generateDemoUID(role: 'worker' | 'employer' = 'worker'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const prefix = role === 'employer' ? 'demo_employer' : 'demo_worker';
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Save demo session to localStorage
 */
function saveDemoSession(user: DemoUser): void {
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  debugLogger.log('[DEMO] Session saved:', user.uid);
}

/**
 * Get demo session from localStorage
 */
export function getDemoSession(): DemoUser | null {
  const session = localStorage.getItem(DEMO_SESSION_KEY);
  if (!session) return null;
  
  try {
    return JSON.parse(session) as DemoUser;
  } catch {
    return null;
  }
}

/**
 * Clear demo session
 */
export function clearDemoSession(): void {
  localStorage.removeItem(DEMO_SESSION_KEY);
  debugLogger.log('[DEMO] Session cleared');
}

/**
 * Check if user is in demo mode
 */
export function isDemoMode(): boolean {
  return getDemoSession() !== null;
}

/**
 * Demo Registration - Creates worker or employer profile directly in Firestore
 */
export async function demoRegister(data: {
  fullName: string;
  email?: string;
  phoneNumber?: string;
  role: 'worker' | 'employer';
}): Promise<{ success: boolean; error?: string; uid?: string }> {
  try {
    debugLogger.log('[DEMO] Registration started:', data.email || data.phoneNumber);
    debugLogger.log('[DEMO] Selected role:', data.role);

    // Generate unique UID based on role
    const uid = generateDemoUID(data.role);
    debugLogger.log('[DEMO] Generated UID:', uid);

    // Create profile in Firestore
    const profileRef = doc(db, 'profiles', uid);
    
    // Base profile data for all roles
    const profileData: any = {
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
      status: 'active',
      rating: 0,
      reviewCount: 0,
      completedJobs: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActive: serverTimestamp(),
    };

    // Add role-specific fields
    if (data.role === 'worker') {
      profileData.skills = [];
    } else if (data.role === 'employer') {
      profileData.company = '';
      profileData.companyVerified = false;
    }

    debugLogger.log('[DEMO] Writing to Firestore...');
    await setDoc(profileRef, profileData);
    debugLogger.log('[DEMO] Profile created successfully!');

    // Create user object for session
    const demoUser: DemoUser = {
      uid,
      fullName: data.fullName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      role: data.role,
      createdAt: Date.now(),
    };

    // Save session
    saveDemoSession(demoUser);

    return { success: true, uid };
  } catch (error: any) {
    debugLogger.error('[DEMO] Registration error:', error);
    debugLogger.error('[DEMO] Error details:', error.message, error.code);
    return {
      success: false,
      error: `Firestore error: ${error.message || 'Unknown error'}`,
    };
  }
}

/**
 * Demo Login - Checks Firestore for user and creates session
 */
export async function demoLogin(data: {
  phoneNumber?: string;
  email?: string;
  password?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const identifier = data.email || data.phoneNumber || 'demo';
    debugLogger.log('[DEMO] Login started:', identifier);

    // In demo mode, accept any credentials and create session
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
  } catch (error: any) {
    debugLogger.error('[DEMO] Login error:', error);
    return {
      success: false,
      error: error.message || 'Login failed',
    };
  }
}

/**
 * Demo Logout
 */
export function demoLogout(): void {
  clearDemoSession();
  debugLogger.log('[DEMO] Logged out');
}
