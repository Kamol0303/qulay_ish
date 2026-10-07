import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SUBSCRIPTION_KEY = 'requiresSubscription';

/**
 * Mark a Super Admin endpoint as blocked once the platform subscription is
 * expired. Never apply to export/backup or to the subscription endpoints
 * themselves. The SubscriptionGuard enforces it server-side.
 */
export const RequiresSubscription = () =>
  SetMetadata(REQUIRES_SUBSCRIPTION_KEY, true);
