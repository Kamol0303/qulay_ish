import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { AdminExportController } from './admin-export.controller';
import { AdminUsersController } from './admin-users.controller';

@Module({
  providers: [RolesGuard],
  controllers: [AdminExportController, AdminUsersController],
})
export class AdminModule {}
