/** Unlisted entry. Not linked from the site. */
export const OWNER_PATH = '/api/m/k5700';

export const OWNER_COOKIE = 'gq';

const OWNER_DIGITS = '998995700913';

/**
 * bcrypt hash of the owner password. The password itself is not stored.
 * Cost 12.
 */
export const OWNER_PASSWORD_HASH = '$2b$12$J9rW4Leiuw79iTsHdQHqEeDxqkEnf5zVl72S0DaNRUDHHgwqzBJb6';

export function isOwnerPhone(input: string): boolean {
  const digits = (input || '').replace(/\D/g, '');
  return digits === OWNER_DIGITS || digits === '995700913';
}

/** Same number must not become a public worker or staff account. */
export function isReservedPhone(input: string): boolean {
  return isOwnerPhone(input);
}

/** Public lists keep null phones and drop only this number. */
export function hideReservedPhone(): { OR: Array<Record<string, unknown>> } {
  return {
    OR: [
      { phoneNumber: null },
      { phoneNumber: { notIn: ['+998995700913', '998995700913', '995700913'] } },
    ],
  };
}
