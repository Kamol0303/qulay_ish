import { Module } from '@nestjs/common';
import { OwnerController, PublicGateController } from './owner.controller';
import { PlatformGateService } from './platform-gate.service';

@Module({
  controllers: [PublicGateController, OwnerController],
  providers: [PlatformGateService],
  exports: [PlatformGateService],
})
export class OwnerModule {}
