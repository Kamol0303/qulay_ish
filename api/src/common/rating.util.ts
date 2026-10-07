/** Clamp a raw star rating into the valid 1..5 integer range. */
export function clampStars(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(1, n));
}

/**
 * Fold a new rating into a running average. Returns the new rounded average
 * (1 decimal) and the incremented count. Keeps review aggregation consistent
 * without re-reading every historical review.
 */
export function foldRating(
  currentAvg: number,
  currentCount: number,
  newRating: number,
): { rating: number; reviewCount: number } {
  const count = Math.max(0, Math.floor(currentCount));
  const stars = clampStars(newRating);
  const prevTotal = (Number.isFinite(currentAvg) ? currentAvg : 0) * count;
  const nextCount = count + 1;
  const nextAvg = (prevTotal + stars) / nextCount;
  return { rating: Math.round(nextAvg * 10) / 10, reviewCount: nextCount };
}
