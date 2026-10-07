import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { DevSmsService } from '../auth/devsms.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionGuard } from './subscription.guard';

@Module({
  providers: [SubscriptionService, SubscriptionGuard, RolesGuard, DevSmsService],
  controllers: [SubscriptionController],
  exports: [SubscriptionService, SubscriptionGuard],
})
export class SubscriptionModule {}
