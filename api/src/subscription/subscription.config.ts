/** Free trial window from first activation. */
export const SUBSCRIPTION_FREE_DAYS = 30;
/** Days of continued access after expiry before pages are blocked. */
export const SUBSCRIPTION_GRACE_DAYS = 7;
/** Show a warning banner this many days before the period ends. */
export const SUBSCRIPTION_WARNING_DAYS = 7;
/** A paid period lasts this many days. */
export const SUBSCRIPTION_PERIOD_DAYS = 30;

/** Admin-configurable price bounds (som). */
export const PRICE_MIN = 240_000;
export const PRICE_MAX = 300_000;
/** Prices are always a round multiple of this step (…240000, 250000, …, 300000). */
export const PRICE_STEP = 10_000;
export const PRICE_DEFAULT = 240_000;

/** Clamp into [PRICE_MIN, PRICE_MAX] and snap to the nearest round step (ends in 000). */
export function snapPrice(value: number): number {
  if (!Number.isFinite(value)) return PRICE_DEFAULT;
  const bounded = Math.min(PRICE_MAX, Math.max(PRICE_MIN, Math.round(value)));
  return Math.round(bounded / PRICE_STEP) * PRICE_STEP;
}

/**
 * Pick a round price in [PRICE_MIN, PRICE_MAX]. `randomStep(steps)` must return an
 * integer in [0, steps]; the result is always a multiple of PRICE_STEP.
 */
export function pickRoundPrice(randomStep: (steps: number) => number): number {
  const steps = Math.floor((PRICE_MAX - PRICE_MIN) / PRICE_STEP);
  const idx = Math.min(steps, Math.max(0, Math.floor(randomStep(steps))));
  return PRICE_MIN + idx * PRICE_STEP;
}

/** Payment confirmation OTP policy. */
export const PAYMENT_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const PAYMENT_OTP_MAX_ATTEMPTS = 5;
export const PAYMENT_OTP_RATE_LIMIT_MS = 60 * 1000; // 1 request / minute

export type SubscriptionStatus = 'active' | 'grace' | 'expired';

/**
 * Super Admin pages blocked once the subscription is expired (past grace).
 * Export and backup are intentionally NOT in this list — they must never be
 * blocked so data stays recoverable. The frontend reads this same list.
 */
export const BLOCKED_SUPER_ADMIN_PATHS: string[] = [
  '/super-admin/users',
  '/super-admin/jobs',
  '/super-admin/applications',
  '/super-admin/contracts',
  '/super-admin/verifications',
  '/super-admin/finance',
  '/super-admin/settings',
];
