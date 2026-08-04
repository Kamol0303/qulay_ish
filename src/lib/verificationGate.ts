import type { Profile } from '../types';

/** Identity verification required for job posting / applications */
export function isIdentityVerified(profile: Pick<Profile, 'isVerified' | 'verificationStatus'> | null | undefined): boolean {
  if (!profile) return false;
  return profile.isVerified === true || profile.verificationStatus === 'verified';
}

export const VERIFICATION_REQUIRED_MESSAGE =
  'Shaxsni tasdiqlashdan o‘ting. Tasdiqlangandan keyin bu amalni bajarishingiz mumkin.';
