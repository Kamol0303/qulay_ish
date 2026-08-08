import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';

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

type OtpPurpose = 'login' | 'register' | 'reset';

/** Load api/.env even if Nest ConfigModule order/cwd is unusual (pm2, systemd). */
function ensureApiEnvLoaded(): void {
  const candidates = [
    join(__dirname, '..', '.env'), // api/dist → api/.env
    join(__dirname, '..', '..', '.env'), // nested
    join(process.cwd(), 'api', '.env'),
    join(process.cwd(), '.env'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      dotenv.config({ path, override: false });
    }
  }
}

/**
 * DevSMS universal_otp — https://devsms.uz/api/docs.php
 * service_name: letters/numbers/spaces/dots/hyphens only (no apostrophe).
 */
@Injectable()
export class DevSmsService implements OnModuleInit {
  private readonly logger = new Logger(DevSmsService.name);
  private readonly balanceWarnThreshold: number;

  constructor() {
    ensureApiEnvLoaded();
    this.balanceWarnThreshold = Number(process.env.DEVSMS_BALANCE_WARN_THRESHOLD || 10000);
  }

  onModuleInit() {
    ensureApiEnvLoaded();
    const token = this.getToken();
    if (!token) {
      if (this.isDevMode()) {
        this.logger.warn("DEVSMS_TOKEN yo'q — OTP faqat terminalda [DEV OTP]");
        return;
      }
      this.logger.error(
        "DEVSMS_TOKEN topilmadi (api/.env). APK/saytdan OTP SMS ishlamaydi!",
      );
      return;
    }
    this.logger.log('========================================');
    this.logger.log('OTP_ENGINE=UNIVERSAL_OTP_V3');
    this.logger.log(`DevSMS token: ${this.maskToken(token)}`);
    this.logger.log(`service: ${this.getServiceNames().join(', ')}`);
    this.logger.log(`base: ${this.getBaseUrl()}`);
    this.logger.log('========================================');
  }

  /** Public status for ops (no secrets). */
  getStatus() {
    ensureApiEnvLoaded();
    const token = this.getToken();
    return {
      engine: 'UNIVERSAL_OTP_V3',
      configured: Boolean(token),
      tokenPresent: Boolean(token),
      tokenMasked: token ? this.maskToken(token) : null,
      baseUrl: this.getBaseUrl(),
      serviceNames: this.getServiceNames(),
      devMode: this.isDevMode(),
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  private getBaseUrl(): string {
    return (process.env.DEVSMS_BASE_URL || 'https://devsms.uz/api').replace(/\/$/, '');
  }

  private getToken(): string {
    ensureApiEnvLoaded();
    return this.normalizeToken(process.env.DEVSMS_TOKEN);
  }

  private isDevMode(): boolean {
    const token = this.getToken();
    return (
      process.env.DEVSMS_DEV_MODE === 'true' ||
      (!token && process.env.NODE_ENV !== 'production')
    );
  }

  private getServiceNames(): string[] {
    // Apostrophe (Qo'llar) DevSMS da taqiqlangan — "Qollar" ishlatiladi
    const primary =
      process.env.DEVSMS_SERVICE_NAME?.trim() ||
      process.env.DEVSMS_FROM?.trim() ||
      'Mexrli Qollar';
    const names = [
      primary,
      'Mexrli Qollar',
      'ishliayol.uz',
      'mexrliqollar.uz',
      'ishliayol',
      'mexrliqollar',
    ];
    // Dedupe, drop empty, sanitize apostrophes
    return [...new Set(names.map((n) => n.replace(/'/g, '').trim()).filter(Boolean))];
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
    const token = this.getToken();
    if (!token) {
      throw new DevSmsError('TOKEN_MISSING', "DevSMS token sozlanmagan (api/.env DEVSMS_TOKEN)");
    }

    const url = `${this.getBaseUrl()}/send_sms.php`;
    this.logger.log(`DevSMS so'rov: ${JSON.stringify(body)}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error('DevSMS network error', err);
      throw new DevSmsError('NETWORK_ERROR', "DevSMS bilan bog'lanib bo'lmadi");
    }

    let data: DevSmsResponse;
    try {
      data = (await res.json()) as DevSmsResponse;
    } catch {
      throw new DevSmsError('INVALID_RESPONSE', "DevSMS javobi noto'g'ri");
    }

    if (!data.success) {
      const message = data.error || data.message || 'UNKNOWN_ERROR';
      const code = res.status === 401 ? 'ACCESS_TOKEN_INVALID' : this.inferCode(message);
      this.logger.warn(`DevSMS xato (${res.status}): ${message}`);
      throw new DevSmsError(code, message, data);
    }

    if (!data.data?.request_id) {
      throw new DevSmsError('EMPTY_RESULT', "DevSMS bo'sh javob qaytardi", data);
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
    // 3 = register, 4 = login, 2 = password reset (DevSMS docs)
    if (purpose === 'register') return 3;
    if (purpose === 'reset') return 2;
    return 4;
  }

  async sendOtpSms(
    phone: string,
    code: string,
    purpose: OtpPurpose = 'login',
  ): Promise<{ smsId: number; requestId: string }> {
    ensureApiEnvLoaded();
    const token = this.getToken();

    if (!token && this.isDevMode()) {
      this.logger.warn(`[DEV OTP] ${phone} → ${code}`);
      return { smsId: 0, requestId: `dev-${randomUUID()}` };
    }

    const templateType = this.templateType(purpose);
    let lastError: DevSmsError | undefined;
    const serviceNames = this.getServiceNames();

    for (let i = 0; i < serviceNames.length; i++) {
      const serviceName = serviceNames[i];
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
        if (i < serviceNames.length - 1) {
          this.logger.warn(
            `service_name="${serviceName}" ishlamadi — "${serviceNames[i + 1]}" sinanmoqda`,
          );
        }
      }
    }

    throw lastError ?? new DevSmsError('SEND_FAILED', "SMS yuborib bo'lmadi");
  }
}
