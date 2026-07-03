import { Profile } from '../types';

const STORAGE_PREFIX = 'qulay_ish_2fa_verified_';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface TwoFactorSession {
  uid: string;
  verifiedAt: number;
  expiresAt: number;
}

export function isTwoFactorEnabled(profile: Profile | null | undefined): boolean {
  return !!profile?.twoFactorEnabled;
}

export function requiresMandatoryTwoFactorSetup(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  return profile.role === 'super_admin' && !profile.twoFactorEnabled;
}

export function getTwoFactorStorageKey(uid: string): string {
  return `${STORAGE_PREFIX}${uid}`;
}

export function markTwoFactorVerified(uid: string, verifiedAt = Date.now()): void {
  const payload: TwoFactorSession = {
    uid,
    verifiedAt,
    expiresAt: verifiedAt + SESSION_TTL_MS,
  };
  sessionStorage.setItem(getTwoFactorStorageKey(uid), JSON.stringify(payload));
}

export function clearTwoFactorVerification(): void {
  Object.keys(sessionStorage).forEach((key) => {
    if (key.startsWith(STORAGE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
}

export function isTwoFactorVerifiedForUser(uid: string | undefined): boolean {
  if (!uid) return false;
  const raw = sessionStorage.getItem(getTwoFactorStorageKey(uid));
  if (!raw) return false;
  try {
    const session = JSON.parse(raw) as TwoFactorSession;
    if (session.uid !== uid) return false;
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(getTwoFactorStorageKey(uid));
      return false;
    }
    return true;
  } catch {
    sessionStorage.removeItem(getTwoFactorStorageKey(uid));
    return false;
  }
}
