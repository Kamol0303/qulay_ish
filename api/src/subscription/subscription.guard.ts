import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_SUBSCRIPTION_KEY } from './requires-subscription.decorator';
import { SubscriptionService } from './subscription.service';

/**
 * Blocks endpoints marked with @RequiresSubscription when the platform
 * subscription is expired (past grace). Returns 403 with code
 * "subscription_required". Workers/employers are never affected because only
 * super-admin-scoped endpoints carry the marker.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscription: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_SUBSCRIPTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const blocked = await this.subscription.isBlocked();
    if (blocked) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'subscription_required',
        message: "Obuna muddati tugagan. Davom etish uchun to'lov qiling.",
      });
    }
    return true;
  }
}
