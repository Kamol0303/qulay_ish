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
        this.logger.warn("DEVSMS_TOKEN yo'q — SMS ketmaydi");
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

  private async call(body: Record<string, unknown>): Promise<{ smsId: number; requestId: string; balance?: number }> {
    const token = this.getToken();
    if (!token) {
      throw new DevSmsError('TOKEN_MISSING', "DevSMS token sozlanmagan (api/.env DEVSMS_TOKEN)");
    }

    const url = `${this.getBaseUrl()}/send_sms.php`;
    const logged = { ...body };
    if ('otp_code' in logged) logged.otp_code = '******';
    this.logger.log(`DevSMS so'rov: ${JSON.stringify(logged)}`);

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

    return { smsId: data.data.sms_id, requestId: data.data.request_id, balance: data.data.balance };
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
  ): Promise<{ smsId: number; requestId: string; balance?: number }> {
    ensureApiEnvLoaded();
    const token = this.getToken();

    if (!token && this.isDevMode()) {
      this.logger.warn(`[DEV OTP] ${phone} — SMS ketmaydi, token yo'q`);
      return { smsId: 0, requestId: `dev-${randomUUID()}`, balance: undefined };
    }

    const templateType = this.templateType(purpose);
    let lastError: DevSmsError | undefined;
    const serviceNames = this.getServiceNames();

    const callback = this.callbackFields();
    for (let i = 0; i < serviceNames.length; i++) {
      const serviceName = serviceNames[i];
      try {
        return await this.call({
          phone: this.toDevSmsPhone(phone),
          type: 'universal_otp',
          template_type: templateType,
          service_name: serviceName,
          otp_code: code,
          ...callback,
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

  /**
   * Best-effort free-text notification SMS (e.g. "worker finished the job").
   * Never throws — a failed SMS must not block the in-app flow. Returns true
   * when the provider accepted the message, false otherwise. In dev mode (no
   * token) the message is only logged.
   */
  async sendNotificationSms(phone: string, message: string): Promise<boolean> {
    ensureApiEnvLoaded();
    const token = this.getToken();
    const cleanPhone = this.toDevSmsPhone(phone);
    const text = message.trim().slice(0, 500);
    if (!cleanPhone || !text) return false;

    if (!token) {
      if (this.isDevMode()) {
        this.logger.warn(`[DEV SMS] ${phone} → ${text}`);
        return true;
      }
      this.logger.error('DEVSMS_TOKEN yo\'q — bildirishnoma SMS yuborilmadi');
      return false;
    }

    const url = `${this.getBaseUrl()}/send_sms.php`;
    for (const serviceName of this.getServiceNames()) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            phone: cleanPhone,
            type: 'sms',
            service_name: serviceName,
            message: text,
            text,
            ...this.callbackFields(),
          }),
        });
        const data = (await res.json().catch(() => null)) as DevSmsResponse | null;
        if (res.ok && data?.success) {
          this.logger.log(`Bildirishnoma SMS yuborildi: ${cleanPhone}`);
          return true;
        }
        this.logger.warn(
          `Bildirishnoma SMS rad etildi (service="${serviceName}", ${res.status}): ${
            data?.error || data?.message || 'noma\'lum'
          }`,
        );
      } catch (err) {
        this.logger.warn(
          `Bildirishnoma SMS xatosi (service="${serviceName}"): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return false;
  }

  /**
   * Official balance. Returns an error instead of a made-up number when the
   * token is missing or the provider does not answer.
   */
  async fetchBalance(): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'Token yo‘q' };
    try {
      const res = await fetch(`${this.getBaseUrl()}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; data?: { balance?: unknown }; error?: string } | null;
      if (!res.ok || !data?.success) return { ok: false, error: data?.error || `Balans ${res.status}` };
      const balance = wholeSom(data.data?.balance);
      if (balance == null) return { ok: false, error: 'Balans javobi bo‘sh' };
      if (balance < this.balanceWarnThreshold) this.logger.warn(`DevSMS balance past: ${balance}`);
      return { ok: true, balance };
    } catch {
      return { ok: false, error: 'Balans olinmadi' };
    }
  }

  /**
   * Official status. The message body is dropped so an OTP code is never logged.
   */
  async fetchSmsStatus(query: { smsId?: number | null; requestId?: string }): Promise<
    { ok: true; status: string; error: string; missing?: false } | { ok: false; error: string; missing?: boolean }
  > {
    const token = this.getToken();
    if (!token) return { ok: false, error: 'Token yo‘q' };
    const params = new URLSearchParams();
    if (query.smsId && query.smsId > 0) params.set('sms_id', String(query.smsId));
    else if (query.requestId && !query.requestId.startsWith('dev-')) params.set('request_id', query.requestId);
    else return { ok: false, error: 'So‘rov yo‘q' };
    try {
      const res = await fetch(`${this.getBaseUrl()}/sms/status?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (res.status === 404) return { ok: false, error: 'SMS topilmadi', missing: true };
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        data?: { status?: string; error_message?: string | null; message?: string };
      } | null;
      if (!res.ok || !data?.success || !data.data?.status) {
        return { ok: false, error: data?.error || `Holat ${res.status}` };
      }
      return { ok: true, status: data.data.status, error: data.data.error_message || '' };
    } catch {
      return { ok: false, error: 'Holat olinmadi' };
    }
  }

  /** Public callback only when a webhook secret and a non-local URL exist. */
  private callbackFields(): { callback_url?: string } {
    const secret = (process.env.DEVSMS_WEBHOOK_SECRET || '').trim();
    if (!secret) return {};
    const explicit = (process.env.DEVSMS_WEBHOOK_URL || '').trim();
    const origin = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim().replace(/\/$/, '');
    const url = explicit || (origin ? `${origin}/api/sms/hook` : '');
    if (!isPublicHook(url)) return {};
    return { callback_url: url };
  }
}

function wholeSom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return null;
}

function isPublicHook(url: string): boolean {
  if (!url || url.length > 500) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host === 'example.com' || host === 'test.com') return false;
  if (host === '::1' || host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) {
    return false;
  }
  const parts = host.split('.');
  if (parts[0] === '172') {
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return false;
  }
  return true;
}
