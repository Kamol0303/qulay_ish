import { Controller, Post, Req, Res } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { webhookSignatureOk, webhookTimestampFresh } from './platform-gate.policy';
import { PlatformGateService } from './platform-gate.service';

@Controller('sms')
export class SmsHookController {
  constructor(private readonly gate: PlatformGateService) {}

  @Post('hook')
  async hook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const secret = (process.env.DEVSMS_WEBHOOK_SECRET || '').trim();
    const raw = req.rawBody ? req.rawBody.toString('utf8') : '';
    const timestamp = String(req.header('x-devsms-timestamp') || '');
    const signature = String(req.header('x-devsms-signature') || '');
    const now = Math.floor(Date.now() / 1000);
    if (!secret || !raw || !webhookSignatureOk(secret, timestamp, raw, signature)) {
      res.status(401).json({ ok: false });
      return;
    }
    if (!webhookTimestampFresh(timestamp, now)) {
      res.status(400).json({ ok: false });
      return;
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      await this.gate.noteDead('json');
      res.status(200).json({ ok: true, dead: true });
      return;
    }
    const status = typeof body.status === 'string' ? body.status : '';
    const smsRaw = body.sms_id;
    const smsId = typeof smsRaw === 'number' ? smsRaw : Number(smsRaw);
    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const error = typeof body.error_message === 'string' ? body.error_message : '';
    if (!status || (!Number.isFinite(smsId) && !requestId)) {
      await this.gate.noteDead('payload');
      res.status(200).json({ ok: true, dead: true });
      return;
    }
    try {
      const result = await this.gate.applyProviderEvent({
        smsId: Number.isFinite(smsId) ? smsId : null,
        requestId,
        status,
        error,
      });
      if (result === 'missing') {
        res.status(404).json({ ok: false });
        return;
      }
      res.status(200).json({ ok: true, result });
    } catch {
      res.status(503).json({ ok: false });
    }
  }
}
