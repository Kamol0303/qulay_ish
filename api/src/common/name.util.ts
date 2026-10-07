/**
 * Helpers for the first_name / last_name split while keeping full_name as the
 * canonical compat column. Rule: first whitespace token = first name, the rest = last name.
 */

export function splitFullName(full?: string | null): { firstName: string; lastName: string } {
  const trimmed = (full ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, idx), lastName: trimmed.slice(idx + 1) };
}

export function composeFullName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  const composed = `${first} ${last}`.trim().replace(/\s+/g, ' ');
  return composed || (fallback ?? '').trim();
}

/**
 * Normalize whatever name fields are present (firstName/lastName and/or fullName)
 * into a consistent { firstName, lastName, fullName } triple.
 */
export function normalizeNameInput(input: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}): { firstName: string; lastName: string; fullName: string } {
  const hasSplit =
    (input.firstName && input.firstName.trim()) || (input.lastName && input.lastName.trim());
  if (hasSplit) {
    const firstName = (input.firstName ?? '').trim();
    const lastName = (input.lastName ?? '').trim();
    return { firstName, lastName, fullName: composeFullName(firstName, lastName, input.fullName) };
  }
  const { firstName, lastName } = splitFullName(input.fullName);
  return { firstName, lastName, fullName: (input.fullName ?? '').trim() };
}
