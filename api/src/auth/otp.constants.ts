export const OTP_TTL_MS = 5 * 60 * 1000;
/** Har bir OTP sessiyasi uchun maksimal noto'g'ri urinish (spec). 15 daqiqa lock yo'q — limit tugagach yangi OTP so'ralsin. */
export const OTP_MAX_ATTEMPTS = 5;
/** Bir telefon uchun yangi OTP so'rash oralig'i */
export const OTP_RATE_LIMIT_MS = 60 * 1000;
export const UZ_PHONE_E164 = /^\+998\d{9}$/;

/** Eskiz moderatsiyadan o'tgan shablon — matn shablon bilan 1:1 mos bo'lishi kerak */
export function buildOtpSmsMessage(
  code: string,
  _purpose?: 'login' | 'register' | 'reset',
): string {
  // my.eskiz.uz da tasdiqlangan shablon (login/register/reset uchun hozircha bir xil)
  return `mexrliqollar.uz saytiga ro'yxatdan o'tish uchun tasdiqlash kodi: ${code}`;
}
