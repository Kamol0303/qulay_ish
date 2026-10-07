import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import {
  UsersController,
  JobsController,
  ApplicationsController,
  ContractsController,
  NotificationsController,
  ChatMessagesController,
  DisputesController,
  ReviewsController,
  SavedJobsController,
  ServicePostsController,
  PaymentsController,
  ViolationsController,
  ActivityLogsController,
  SystemLogsController,
  SettingsController,
  StatsController,
} from './resources.controllers';

@Module({
  imports: [SubscriptionModule],
  providers: [RolesGuard],
  controllers: [
    UsersController,
    JobsController,
    ApplicationsController,
    ContractsController,
    NotificationsController,
    ChatMessagesController,
    DisputesController,
    ReviewsController,
    SavedJobsController,
    ServicePostsController,
    PaymentsController,
    ViolationsController,
    ActivityLogsController,
    SystemLogsController,
    SettingsController,
    StatsController,
  ],
})
export class ResourcesModule {}
