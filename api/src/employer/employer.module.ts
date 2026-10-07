import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { EmployerController } from './employer.controller';

@Module({
  providers: [RolesGuard],
  controllers: [EmployerController],
})
export class EmployerModule {}
