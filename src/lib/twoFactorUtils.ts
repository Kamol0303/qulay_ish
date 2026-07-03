/**
 * Normalize user-entered authenticator code to 6 digits.
 */
export function normalizeAuthCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

/**
 * Normalize backup code input (XXXX-XXXX).
 */
export function normalizeBackupCode(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}
