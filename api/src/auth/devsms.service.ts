import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { buildOtpSmsMessage } from './otp.constants';

export class DevSmsError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly raw?: unknown,
  ) {
    super(message || code);
    this.name = 'DevSmsError';
  }
}

type DevSmsResponse = {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    sms_id: number;
    request_id: string;
    status: string;
  };
};

@Injectable()
export class DevSmsService implements OnModuleInit {
  private readonly logger = new Logger(DevSmsService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly from: string | undefined;
  private readonly devMode: boolean;

  constructor() {
    this.baseUrl = (process.env.DEVSMS_BASE_URL || 'https://devsms.uz/api').replace(/\/$/, '');
    this.token = this.normalizeToken(process.env.DEVSMS_TOKEN);
    this.from = process.env.DEVSMS_FROM?.trim() || undefined;
    this.devMode =
      process.env.DEVSMS_DEV_MODE === 'true' ||
      (!this.token && process.env.NODE_ENV !== 'production');
  }

  onModuleInit() {
    if (!this.token) {
      if (this.devMode) {
        this.logger.warn(
          'DEVSMS_TOKEN yo\'q — dev rejim: OTP kodlari konsolga chiqariladi (production uchun token qo\'ying)',
        );
        return;
      }
      this.logger.error('DEVSMS_TOKEN topilmadi — OTP yuborilmaydi');
      return;
    }
    this.logger.log(`DevSMS token yuklandi (${this.maskToken(this.token)})`);
  }

  private normalizeToken(raw: string | undefined): string {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed || trimmed === 'your_token') return '';
    return trimmed.replace(/^['"]|['"]$/g, '');
  }

  private maskToken(token: string): string {
    if (token.length <= 12) return '***';
    return `${token.slice(0, 8)}...${token.slice(-4)}`;
  }

  toDevSmsPhone(e164Phone: string): string {
    return e164Phone.replace(/\D/g, '');
  }

  private async call(body: Record<string, unknown>): Promise<{ smsId: number; requestId: string }> {
    if (!this.token) {
      throw new DevSmsError('TOKEN_MISSING', 'DevSMS token sozlanmagan');
    }

    const url = `${this.baseUrl}/send_sms.php`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error('DevSMS network error', err);
      throw new DevSmsError('NETWORK_ERROR', 'DevSMS bilan bog\'lanib bo\'lmadi');
    }

    let data: DevSmsResponse;
    try {
      data = (await res.json()) as DevSmsResponse;
    } catch {
      throw new DevSmsError('INVALID_RESPONSE', 'DevSMS javobi noto\'g\'ri');
    }

    if (!data.success) {
      const message = data.error || 'UNKNOWN_ERROR';
      const code = res.status === 401 ? 'ACCESS_TOKEN_INVALID' : this.inferCode(message);
      this.logger.warn(`DevSMS send failed (${res.status}): ${message}`);
      throw new DevSmsError(code, message, data);
    }

    if (!data.data?.request_id) {
      throw new DevSmsError('EMPTY_RESULT', 'DevSMS bo\'sh javob qaytardi', data);
    }

    return {
      smsId: data.data.sms_id,
      requestId: data.data.request_id,
    };
  }

  private inferCode(message: string): string {
    const upper = message.toUpperCase();
    if (upper.includes('BALANS') || upper.includes('BALANCE')) return 'INSUFFICIENT_BALANCE';
    if (upper.includes('TOKEN') || upper.includes('AUTENTIFIKATSIYA')) return 'ACCESS_TOKEN_INVALID';
    return 'SEND_FAILED';
  }

  /** DevSMS orqali OTP SMS yuborish */
  async sendOtpSms(phone: string, code: string): Promise<{ smsId: number; requestId: string }> {
    if (!this.token && this.devMode) {
      const message = buildOtpSmsMessage(code);
      this.logger.warn(`[DEV OTP] ${phone} → ${code}`);
      this.logger.warn(`[DEV OTP] SMS matni: ${message}`);
      return { smsId: 0, requestId: `dev-${randomUUID()}` };
    }

    const message = buildOtpSmsMessage(code);
    return this.call({
      phone: this.toDevSmsPhone(phone),
      message,
      ...(this.from ? { from: this.from } : {}),
    });
  }
}
