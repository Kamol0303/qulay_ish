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
    total_cost?: number;
    balance?: number;
  };
};

type OtpPurpose = 'login' | 'register';
type OtpSendMode = 'universal_otp' | 'eskiz';

@Injectable()
export class DevSmsService implements OnModuleInit {
  private readonly logger = new Logger(DevSmsService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly from: string | undefined;
  private readonly devMode: boolean;
  private readonly balanceWarnThreshold: number;
  private readonly otpMode: string;
  private readonly serviceName: string;

  constructor() {
    this.baseUrl = (process.env.DEVSMS_BASE_URL || 'https://devsms.uz/api').replace(/\/$/, '');
    this.token = this.normalizeToken(process.env.DEVSMS_TOKEN);
    this.from =
      process.env.DEVSMS_FROM?.trim() ||
      process.env.DEVSMS_SENDER?.trim() ||
      undefined;
    this.devMode =
      process.env.DEVSMS_DEV_MODE === 'true' ||
      (!this.token && process.env.NODE_ENV !== 'production');
    this.balanceWarnThreshold = Number(process.env.DEVSMS_BALANCE_WARN_THRESHOLD || 10000);
    this.otpMode = (process.env.DEVSMS_OTP_MODE || 'auto').toLowerCase();
    this.serviceName = process.env.DEVSMS_SERVICE_NAME?.trim() || 'ishliayol.uz';
  }

  onModuleInit() {
    if (!this.token) {
      if (this.devMode) {
        this.logger.warn(
          'DEVSMS_TOKEN yo\'q — dev rejim: SMS telefonga BORMAYDI, OTP faqat shu terminalda [DEV OTP] bilan chiqadi',
        );
        this.logger.warn('Token: api/.env ichida DEVSMS_TOKEN=...');
        return;
      }
      this.logger.error('DEVSMS_TOKEN topilmadi — OTP yuborilmaydi');
      return;
    }
    this.logger.log(`DevSMS token yuklandi (${this.maskToken(this.token)})`);
    this.logger.log(`DevSMS OTP rejim: ${this.otpMode} | service: ${this.serviceName}`);
    if (this.from) {
      this.logger.log(`DevSMS from: ${this.from}`);
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

  private resolveOtpModes(): OtpSendMode[] {
    if (this.otpMode === 'universal_otp') return ['universal_otp'];
    if (this.otpMode === 'eskiz') return ['eskiz'];
    // auto: avval universal (moderatsiya kerak emas), keyin eskiz shablon
    return ['universal_otp', 'eskiz'];
  }

  private buildEskizMessage(code: string, purpose: OtpPurpose): string {
    const fromEnv = process.env.DEVSMS_OTP_TEMPLATE?.trim();
    if (fromEnv) {
      return fromEnv.replace(/\{code\}/g, code);
    }
    return buildOtpSmsMessage(code, purpose);
  }

  private async call(body: Record<string, unknown>): Promise<{ smsId: number; requestId: string }> {
    if (!this.token) {
      throw new DevSmsError('TOKEN_MISSING', 'DevSMS token sozlanmagan');
    }

    const url = `${this.baseUrl}/send_sms.php`;
    this.logger.debug(`DevSMS POST ${url} body=${JSON.stringify(body)}`);

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
      this.logger.warn(`DevSMS send failed (${res.status}): ${message}`);
      throw new DevSmsError(code, message, data);
    }

    if (!data.data?.request_id) {
      throw new DevSmsError('EMPTY_RESULT', 'DevSMS bo\'sh javob qaytardi', data);
    }

    const result = {
      smsId: data.data.sms_id,
      requestId: data.data.request_id,
      status: data.data.status,
    };
    this.logger.log(
      `DevSMS yuborildi: sms_id=${result.smsId}, request_id=${result.requestId}, status=${result.status ?? 'unknown'}`,
    );
    if (typeof data.data.balance === 'number' && data.data.balance < this.balanceWarnThreshold) {
      this.logger.warn(`DevSMS balance past: ${data.data.balance}`);
    }
    return result;
  }

  private inferCode(message: string): string {
    const upper = message.toUpperCase();
    if (upper.includes('BALANS') || upper.includes('BALANCE')) return 'INSUFFICIENT_BALANCE';
    if (upper.includes('TOKEN') || upper.includes('AUTENTIFIKATSIYA')) return 'ACCESS_TOKEN_INVALID';
    if (upper.includes('МОДЕРАЦ') || upper.includes('MODERAT') || upper.includes('ШАБЛОН')) {
      return 'TEMPLATE_NOT_MODERATED';
    }
    return 'SEND_FAILED';
  }

  private async sendUniversalOtp(
    phone: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<{ smsId: number; requestId: string }> {
    const templateType = purpose === 'register' ? 3 : 4;
    this.logger.log(
      `DevSMS universal_otp: template_type=${templateType}, service=${this.serviceName}, code=${code}`,
    );
    return this.call({
      phone: this.toDevSmsPhone(phone),
      type: 'universal_otp',
      template_type: templateType,
      service_name: this.serviceName,
      otp_code: code,
    });
  }

  private async sendEskizTemplate(
    phone: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<{ smsId: number; requestId: string }> {
    const message = this.buildEskizMessage(code, purpose);
    this.logger.log(`DevSMS eskiz matn: ${message}`);
    const body: Record<string, unknown> = {
      phone: this.toDevSmsPhone(phone),
      message,
    };
    if (this.from) {
      body.from = this.from;
    }
    return this.call(body);
  }

  /** DevSMS orqali OTP SMS yuborish */
  async sendOtpSms(
    phone: string,
    code: string,
    purpose: OtpPurpose = 'login',
  ): Promise<{ smsId: number; requestId: string }> {
    if (!this.token && this.devMode) {
      const message = this.buildEskizMessage(code, purpose);
      this.logger.warn(`[DEV OTP] ${phone} → ${code}`);
      this.logger.warn(`[DEV OTP] SMS matni: ${message}`);
      return { smsId: 0, requestId: `dev-${randomUUID()}` };
    }

    const modes = this.resolveOtpModes();
    let lastError: DevSmsError | undefined;

    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      try {
        if (mode === 'universal_otp') {
          return await this.sendUniversalOtp(phone, code, purpose);
        }
        return await this.sendEskizTemplate(phone, code, purpose);
      } catch (err) {
        if (!(err instanceof DevSmsError)) throw err;
        lastError = err;
        const hasNext = i < modes.length - 1;
        if (hasNext) {
          this.logger.warn(`DevSMS ${mode} xato (${err.message}) — keyingi usul sinanmoqda...`);
          continue;
        }
      }
    }

    throw lastError ?? new DevSmsError('SEND_FAILED', 'SMS yuborib bo\'lmadi');
  }
}
