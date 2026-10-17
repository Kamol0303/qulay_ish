const UZ_PHONE = /^\+998\d{9}$/;

/** Turn a stored phone or a registration email into +998XXXXXXXXX. */
export function registrationPhone(user: {
  phoneNumber?: unknown;
  email?: unknown;
  personalInfo?: unknown;
}): string | null {
  const direct = normalizeUzPhone(user.phoneNumber);
  if (direct) return direct;

  const info = parseInfo(user.personalInfo);
  const fromInfo = normalizeUzPhone(info?.phone);
  if (fromInfo) return fromInfo;

  const email = typeof user.email === 'string' ? user.email : '';
  const local = email.split('@')[0] || '';
  return normalizeUzPhone(local);
}

function parseInfo(value: unknown): { phone?: unknown } | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as { phone?: unknown }) : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as { phone?: unknown };
  return null;
}

export function normalizeUzPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  const phone =
    digits.startsWith('998') && digits.length >= 12
      ? `+${digits.slice(0, 12)}`
      : digits.length === 9
        ? `+998${digits}`
        : null;
  return phone && UZ_PHONE.test(phone) ? phone : null;
}
