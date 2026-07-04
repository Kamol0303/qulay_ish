export interface ValidationError {
  isValid: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\s\-']{2,100}$/u;
const MAX_EMAIL_LENGTH = 254;
const MAX_UZ_PHONE_DIGITS = 12; // 998 + 9 ta raqam

export function isEmailInput(value: string): boolean {
  return value.includes('@');
}

/**
 * Telefon yoki email maydonini kiritishda tozalaydi va uzunlikni cheklaydi.
 * Telefon: faqat raqam (+ boshida bo'lishi mumkin), maks 12 raqam.
 * Email: @ bo'lsa email formatiga ruxsat.
 */
export function sanitizePhoneOrEmailInput(value: string): string {
  if (isEmailInput(value)) {
    return value.replace(/[^\w.@+-]/g, '').slice(0, MAX_EMAIL_LENGTH);
  }

  const hasPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, MAX_UZ_PHONE_DIGITS);

  if (!digits) {
    return hasPlus ? '+' : '';
  }

  return formatPhoneNumber(hasPlus || digits.startsWith('998') ? `+${digits}` : digits);
}

export function validatePhoneOrEmail(value: string): ValidationError {
  const trimmed = value.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Telefon raqam yoki emailni kiriting' };
  }

  if (isEmailInput(trimmed)) {
    return validateEmail(trimmed);
  }

  return validatePhoneNumber(trimmed);
}

/**
 * Faqat telefon raqami uchun (qo'shimcha telefon maydonlari).
 */
export function sanitizePhoneInput(value: string): string {
  const hasPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, MAX_UZ_PHONE_DIGITS);

  if (!digits) {
    return hasPlus ? '+' : '';
  }

  return formatPhoneNumber(hasPlus || digits.startsWith('998') ? `+${digits}` : digits);
}

/**
 * Har qanday kiritilgan telefonni normalize qiladi
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (!digits) return '';

  // agar 998 bilan boshlangan bo‘lsa
  if (digits.startsWith('998')) {
    return `+${digits.slice(0, 12)}`;
  }

  // agar faqat 9 ta raqam yozilgan bo‘lsa
  if (digits.length <= 9) {
    return `+998${digits}`;
  }

  return `+${digits.slice(0, 12)}`;
}

export function validatePhoneNumber(phone: string): ValidationError {
  if (!phone || !phone.trim()) {
    return { isValid: false, error: 'Telefon raqamni kiriting' };
  }

  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');

  if (!digits.startsWith('998')) {
    return { isValid: false, error: 'Telefon +998 bilan boshlanishi kerak' };
  }

  if (digits.length !== 12) {
    return { isValid: false, error: "Telefon 9 ta raqamdan iborat bo'lishi kerak" };
  }

  return { isValid: true };
}

export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');

  if (!digits) return '';

  const country = digits.slice(0, 3);
  const rest = digits.slice(3);

  if (rest.length <= 2) {
    return `+${country} ${rest}`;
  }

  if (rest.length <= 5) {
    return `+${country} ${rest.slice(0, 2)} ${rest.slice(2)}`;
  }

  if (rest.length <= 7) {
    return `+${country} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5)}`;
  }

  return `+${country} ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
}

export function validateEmail(email: string): ValidationError {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Emailni kiriting' };
  }

  if (!EMAIL_PATTERN.test(email.trim())) {
    return { isValid: false, error: "Email noto'g'ri" };
  }

  return { isValid: true };
}

export function validateFullName(name: string): ValidationError {
  const trimmed = name.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Ismni kiriting' };
  }

  if (trimmed.length < 2) {
    return { isValid: false, error: "Ism kamida 2 ta harf bo'lishi kerak" };
  }

  if (!NAME_PATTERN.test(trimmed)) {
    return { isValid: false, error: "Ism noto'g'ri" };
  }

  return { isValid: true };
}

export function maskPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  const digits = normalized.replace(/\D/g, '');

  if (digits.length !== 12) return phone;

  return `+998 ** *** ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}

// ========================================
// DEMO MODE: Relaxed Password Validation
// ========================================
// Remove this function before production!
// In production, use passwordService.validatePassword() instead

export function validatePasswordDemo(password: string): ValidationError {
  // DEMO MODE: Accept any password with minimum 3 characters
  if (!password || password.length < 3) {
    return { isValid: false, error: 'Parol kamida 3 ta belgidan iborat bo\'lishi kerak' };
  }

  return { isValid: true };
}

export function validatePassword(password: string): ValidationError {
  if (!password || password.length < 8) {
    return { isValid: false, error: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta katta harf bo\'lishi kerak' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta kichik harf bo\'lishi kerak' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, error: 'Parolda kamida 1 ta raqam bo\'lishi kerak' };
  }

  return { isValid: true };
}