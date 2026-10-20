import { Module } from '@nestjs/common';
import { DevSmsService } from '../auth/devsms.service';
import { OwnerController, PublicGateController } from './owner.controller';
import { PlatformGateService } from './platform-gate.service';
import { SmsHookController } from './sms-hook.controller';
import { SmsSyncService } from './sms-sync';

@Module({
  controllers: [PublicGateController, OwnerController, SmsHookController],
  providers: [PlatformGateService, DevSmsService, SmsSyncService],
  exports: [PlatformGateService],
})
export class OwnerModule {}
