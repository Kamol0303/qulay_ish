import { ApiError } from './client';

/** Foydalanuvchiga ko'rsatiladigan xabar — texnik tafsilotlarsiz */
export function toUserMessage(error: unknown, fallback = "Ma'lumotlarni yuklab bo'lmadi. Keyinroq qayta urinib ko'ring."): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Kirish huquqi yo'q yoki sessiya tugagan.";
    }
    if (error.status >= 500) {
      return 'Server vaqtincha javob bermayapti. Birozdan keyin qayta urinib ko\'ring.';
    }
    return fallback;
  }
  return fallback;
}

export function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}
