export const OTP_TTL_MS = 5 * 60 * 1000;
/** Har bir OTP sessiyasi uchun maksimal noto'g'ri urinish (spec). 15 daqiqa lock yo'q — limit tugagach yangi OTP so'ralsin. */
export const OTP_MAX_ATTEMPTS = 5;
/** Bir telefon uchun yangi OTP so'rash oralig'i */
export const OTP_RATE_LIMIT_MS = 60 * 1000;
export const UZ_PHONE_E164 = /^\+998\d{9}$/;

export function buildOtpSmsMessage(code: string): string {
  return `Qulay Ish: Tasdiqlash kodingiz ${code}. Kod 5 daqiqa davomida amal qiladi. Kodni hech kimga bermang.`;
}
