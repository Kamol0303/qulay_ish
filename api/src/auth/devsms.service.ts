import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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

  constructor() {
    this.baseUrl = (process.env.DEVSMS_BASE_URL || 'https://devsms.uz/api').replace(/\/$/, '');
    this.token = this.normalizeToken(process.env.DEVSMS_TOKEN);
    this.from = process.env.DEVSMS_FROM?.trim() || undefined;
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn(
        'DEVSMS_TOKEN topilmadi — api/.env faylini tekshiring va serverni qayta ishga tushiring',
      );
      return;
    }
    this.logger.log(`DevSMS token yuklandi (${this.maskToken(this.token)})`);
  }

  private normalizeToken(raw: string | undefined): string {
    if (!raw) return '';
    const trimmed = raw.trim();
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

  /** Spec bo'yicha aniq SMS matni */
  async sendOtpSms(phone: string, code: string): Promise<{ smsId: number; requestId: string }> {
    const message = buildOtpSmsMessage(code);
    return this.call({
      phone: this.toDevSmsPhone(phone),
      message,
      ...(this.from ? { from: this.from } : {}),
    });
  }
}
