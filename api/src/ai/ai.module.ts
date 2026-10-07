import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/roles.guard';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';

@Module({
  providers: [AiService, RolesGuard],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
