import QRCode from 'qrcode';
import { URI } from 'otpauth';

const TOTP_ISSUER = 'Qulay Ish';

/**
 * Generate a QR code data URL from a server-provided otpauth URI.
 */
export async function generateTotpQrDataUrl(otpauthUri: string): Promise<string> {
  const parsed = URI.parse(otpauthUri);
  if (!parsed) {
    throw new Error('Invalid otpauth URI');
  }
  return QRCode.toDataURL(otpauthUri, {
    width: 220,
    margin: 2,
    color: {
      dark: '#1e3a8a',
      light: '#ffffff',
    },
  });
}

/**
 * Validate otpauth URI structure without exposing secrets client-side.
 */
export function isValidOtpauthUri(otpauthUri: string): boolean {
  try {
    const parsed = URI.parse(otpauthUri);
    return parsed?.issuer === TOTP_ISSUER;
  } catch {
    return false;
  }
}

/**
 * Normalize user-entered TOTP code to 6 digits.
 */
export function normalizeTotpCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

/**
 * Normalize backup code input (XXXX-XXXX).
 */
export function normalizeBackupCode(input: string): string {
  const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleaned.length <= 4) {
    return cleaned;
  }
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}
