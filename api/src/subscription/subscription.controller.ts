import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SubscriptionService } from './subscription.service';
import {
  BLOCKED_SUPER_ADMIN_PATHS,
  PRICE_MAX,
  PRICE_MIN,
  SUBSCRIPTION_WARNING_DAYS,
} from './subscription.config';

type AuthUser = { userId: string; role: string };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin/subscription')
export class SubscriptionController {
  constructor(private readonly subscription: SubscriptionService) {}

  @Get('status')
  async status() {
    const snap = await this.subscription.getSnapshot();
    return {
      ...snap,
      priceRange: { min: PRICE_MIN, max: PRICE_MAX },
      warningDays: SUBSCRIPTION_WARNING_DAYS,
      blockedPaths: BLOCKED_SUPER_ADMIN_PATHS,
    };
  }

  @Post('price')
  async setPrice(@Body() body: { priceSom?: number }) {
    return this.subscription.setPrice(Number(body?.priceSom));
  }

  /** Reveal card number + amount for the block screen (Super Admin only). */
  @Post('pay')
  async pay() {
    return this.subscription.getPaymentDetails();
  }

  /** "I paid" — generate OTP and SMS it to the owner phone. */
  @Post('paid')
  async paid(@Req() req: { user: AuthUser }) {
    return this.subscription.requestPaymentOtp(req.user.userId);
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body: { code?: string }, @Req() req: { user: AuthUser }) {
    return this.subscription.verifyPaymentOtp(req.user.userId, String(body?.code || ''));
  }
}
