/** Shared password rules for client/server alignment */
export function assertPasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak';
  }
  return null;
}
