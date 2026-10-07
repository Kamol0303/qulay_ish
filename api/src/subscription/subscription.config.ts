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
export const PRICE_DEFAULT = 240_000;

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
