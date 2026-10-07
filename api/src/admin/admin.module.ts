import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { AdminExportController } from './admin-export.controller';

@Module({
  providers: [RolesGuard],
  controllers: [AdminExportController],
})
export class AdminModule {}
