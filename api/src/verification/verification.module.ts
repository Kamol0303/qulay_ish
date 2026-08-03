import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VerificationRequestsController } from './verification.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [PrismaModule],
  controllers: [VerificationRequestsController],
  providers: [RolesGuard],
})
export class VerificationModule {}
