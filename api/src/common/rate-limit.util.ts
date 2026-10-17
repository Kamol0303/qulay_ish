export type RateBucket = { count: number; resetAt: number };

export type RateDecision = { ok: true } | { ok: false; retryAfterSec: number };

const AUTH_PATHS = new Set([
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
  '/api/auth/login',
  '/api/auth/super-admin/login',
  '/api/auth/reset-password',
]);

export function takeToken(
  buckets: Map<string, RateBucket>,
  key: string,
  now: number,
  windowMs: number,
  max: number,
): RateDecision {
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Tight limit only on OTP and password entry. Ordinary polling stays open. */
export function decideRateLimit(
  buckets: Map<string, RateBucket>,
  path: string,
  ip: string,
  now: number,
): RateDecision {
  const clean = path.split('?')[0];
  if (AUTH_PATHS.has(clean)) {
    const auth = takeToken(buckets, `auth:${ip}`, now, 15 * 60 * 1000, 20);
    if (!auth.ok) return auth;
  }
  return takeToken(buckets, `ip:${ip}`, now, 60 * 1000, 600);
}

export function pruneBuckets(buckets: Map<string, RateBucket>, now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
