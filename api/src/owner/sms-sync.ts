import { Injectable } from '@nestjs/common';
import { DevSmsService } from '../auth/devsms.service';
import { PlatformGateService } from './platform-gate.service';

/** Poll DevSMS when a webhook has not arrived. Skips itself for 20 seconds unless forced. */
@Injectable()
export class SmsSyncService {
  private lastAttempt = 0;

  constructor(
    private readonly sms: DevSmsService,
    private readonly gate: PlatformGateService,
  ) {}

  async pull(force: boolean): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastAttempt < 20_000) return;
    this.lastAttempt = now;
    const balance = await this.sms.fetchBalance();
    if (balance.ok) await this.gate.rememberSmsBalance(balance.balance);
    else await this.gate.rememberSmsBalance(undefined, balance.error);
    const open = await this.gate.openFeeds(12);
    for (const row of open) {
      const status = await this.sms.fetchSmsStatus({ smsId: row.smsId, requestId: row.requestId });
      if (!status.ok) continue;
      await this.gate.applyProviderEvent({
        smsId: row.smsId,
        requestId: row.requestId,
        status: status.status,
        error: status.error,
      });
    }
  }
}
