import { DevSmsService } from '../auth/devsms.service';
import { PlatformGateService } from './platform-gate.service';

/** Charge one SMS, then send. A short balance keeps the notice out of the provider. */
export async function sendMeteredSms(
  gate: PlatformGateService,
  sms: DevSmsService,
  phone: string,
  message: string,
): Promise<void> {
  try {
    const claim = await gate.claimSend('otp', { phone, purpose: 'notice' });
    if (!claim.send) return;
    const ok = await sms.sendNotificationSms(phone, message);
    if (!ok) {
      await gate.markSendFailed('otp', 'SMS ketmadi. Provayder qabul qilmadi.', claim.feedId);
      return;
    }
    await gate.markSendDelivered(claim.feedId);
  } catch {
    /* A notice must not block the in-app action. */
  }
}
