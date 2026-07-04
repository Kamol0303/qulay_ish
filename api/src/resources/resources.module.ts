import { Module } from '@nestjs/common';
import {
  UsersController,
  JobsController,
  ApplicationsController,
  ContractsController,
  NotificationsController,
  ChatMessagesController,
  DisputesController,
  VerificationRequestsController,
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
  controllers: [
    UsersController,
    JobsController,
    ApplicationsController,
    ContractsController,
    NotificationsController,
    ChatMessagesController,
    DisputesController,
    VerificationRequestsController,
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
