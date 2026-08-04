import type { Profile } from '../types';

/** Identity verification required for job posting / applications */
export function isIdentityVerified(
  profile: Pick<Profile, 'isVerified' | 'verificationStatus'> | null | undefined,
): boolean {
  if (!profile) return false;
  return profile.isVerified === true || profile.verificationStatus === 'verified';
}

export const VERIFICATION_REQUIRED_MESSAGE =
  'Iltimos, ishga ariza yuborishdan oldin shaxsingizni tasdiqlang va pasport ma\'lumotlaringizni to\'ldiring.';

export const PASSPORT_FILL_PROMPT = 'Pasport ma\'lumotlaringizni to\'ldiring';

/** Navigate target when an unverified worker tries to apply */
export const VERIFICATION_REDIRECT_STATE = {
  prompt: PASSPORT_FILL_PROMPT,
  message: VERIFICATION_REQUIRED_MESSAGE,
} as const;
