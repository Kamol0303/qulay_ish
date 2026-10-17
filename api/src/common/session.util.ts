/** A null cutoff means every currently issued token is still valid. */
export function isSessionCurrent(iat: number | undefined, validAfter: Date | null | undefined): boolean {
  if (!validAfter) return true;
  if (iat == null || !Number.isFinite(iat)) return false;
  return iat >= Math.floor(validAfter.getTime() / 1000);
}
