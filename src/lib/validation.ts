export interface ValidationError {
  isValid: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[\p{L}\s\-']{2,100}$/u;

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

/** Production password rule: minimum 8 characters (server-enforced too). */
export function validatePassword(password: string): ValidationError {
  if (!password) {
    return { isValid: false, error: 'Parolni kiriting' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' };
  }

  if (password.length > 128) {
    return { isValid: false, error: 'Parol juda uzun' };
  }

  return { isValid: true };
}

export function validatePasswordConfirm(password: string, confirm: string): ValidationError {
  if (!confirm) {
    return { isValid: false, error: 'Parolni tasdiqlang' };
  }
  if (password !== confirm) {
    return { isValid: false, error: 'Parollar mos kelmadi' };
  }
  return { isValid: true };
}

/** @deprecated Use validatePassword — kept for backward compatibility */
export function validatePasswordDemo(password: string): ValidationError {
  return validatePassword(password);
}