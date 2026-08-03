import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';

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
    total_cost?: number;
    balance?: number;
  };
};

type OtpPurpose = 'login' | 'register';

/**
 * Faqat DevSMS universal_otp — maxsus matn (eskiz shablon) KERAK EMAS.
 * https://devsms.uz — Shablon 3: ro'yxatdan o'tish, 4: kirish.
 */
@Injectable()
export class DevSmsService implements OnModuleInit {
  private readonly logger = new Logger(DevSmsService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly devMode: boolean;
  private readonly balanceWarnThreshold: number;
  private readonly serviceNames: string[];

  constructor() {
    this.baseUrl = (process.env.DEVSMS_BASE_URL || 'https://devsms.uz/api').replace(/\/$/, '');
    this.token = this.normalizeToken(process.env.DEVSMS_TOKEN);
    this.devMode =
      process.env.DEVSMS_DEV_MODE === 'true' ||
      (!this.token && process.env.NODE_ENV !== 'production');
    this.balanceWarnThreshold = Number(process.env.DEVSMS_BALANCE_WARN_THRESHOLD || 10000);

    const primary = process.env.DEVSMS_SERVICE_NAME?.trim() || 'ishliayol.uz';
    const names = [primary, 'ishliayol', 'ishliayol.uz'];
    this.serviceNames = [...new Set(names)];
  }

  onModuleInit() {
    if (!this.token) {
      if (this.devMode) {
        this.logger.warn('DEVSMS_TOKEN yo\'q — OTP faqat terminalda [DEV OTP]');
        return;
      }
      this.logger.error('DEVSMS_TOKEN topilmadi');
      return;
    }
    // Bu banner chiqmasa — eski kod ishlayapti (git pull / dist tozalash kerak)
    this.logger.log('========================================');
    this.logger.log('OTP_ENGINE=UNIVERSAL_OTP_V3');
    this.logger.log(`DevSMS token: ${this.maskToken(this.token)}`);
    this.logger.log(`service: ${this.serviceNames.join(', ')}`);
    this.logger.log('========================================');
    if (process.env.DEVSMS_OTP_MODE === 'eskiz') {
      this.logger.warn(
        'DEVSMS_OTP_MODE=eskiz — eskiz rejimi o\'chirildi. api/.env dan olib tashlang, universal_otp ishlatiladi.',
      );
    }
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
    this.logger.log(`DevSMS so'rov: ${JSON.stringify(body)}`);

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
      const message = data.error || data.message || 'UNKNOWN_ERROR';
      const code = res.status === 401 ? 'ACCESS_TOKEN_INVALID' : this.inferCode(message);
      this.logger.warn(`DevSMS xato (${res.status}): ${message}`);
      throw new DevSmsError(code, message, data);
    }

    if (!data.data?.request_id) {
      throw new DevSmsError('EMPTY_RESULT', 'DevSMS bo\'sh javob qaytardi', data);
    }

    this.logger.log(
      `DevSMS yuborildi: sms_id=${data.data.sms_id}, request_id=${data.data.request_id}, balance=${data.data.balance ?? '?'}`,
    );
    if (typeof data.data.balance === 'number' && data.data.balance < this.balanceWarnThreshold) {
      this.logger.warn(`DevSMS balance past: ${data.data.balance}`);
    }

    return { smsId: data.data.sms_id, requestId: data.data.request_id };
  }

  private inferCode(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('balans') || lower.includes('balance')) return 'INSUFFICIENT_BALANCE';
    if (lower.includes('token') || lower.includes('autentifikatsiya')) return 'ACCESS_TOKEN_INVALID';
    if (lower.includes('модерац') || lower.includes('moderat') || lower.includes('шаблон')) {
      return 'TEMPLATE_NOT_MODERATED';
    }
    return 'SEND_FAILED';
  }

  private templateType(purpose: OtpPurpose): number {
    return purpose === 'register' ? 3 : 4;
  }

  /** DevSMS universal OTP — maxsus eskiz matn yuborilmaydi */
  async sendOtpSms(
    phone: string,
    code: string,
    purpose: OtpPurpose = 'login',
  ): Promise<{ smsId: number; requestId: string }> {
    if (!this.token && this.devMode) {
      this.logger.warn(`[DEV OTP] ${phone} → ${code}`);
      return { smsId: 0, requestId: `dev-${randomUUID()}` };
    }

    const templateType = this.templateType(purpose);
    let lastError: DevSmsError | undefined;

    for (const serviceName of this.serviceNames) {
      try {
        return await this.call({
          phone: this.toDevSmsPhone(phone),
          type: 'universal_otp',
          template_type: templateType,
          service_name: serviceName,
          otp_code: code,
        });
      } catch (err) {
        if (!(err instanceof DevSmsError)) throw err;
        lastError = err;
        const next = this.serviceNames.indexOf(serviceName) < this.serviceNames.length - 1;
        if (next) {
          this.logger.warn(`service_name="${serviceName}" ishlamadi — "${this.serviceNames[this.serviceNames.indexOf(serviceName) + 1]}" sinanmoqda`);
        }
      }
    }

    throw lastError ?? new DevSmsError('SEND_FAILED', 'SMS yuborib bo\'lmadi');
  }
}
