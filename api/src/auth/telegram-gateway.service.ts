import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export class TelegramGatewayError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
    public readonly raw?: unknown,
  ) {
    super(message || code);
    this.name = 'TelegramGatewayError';
  }
}

type GatewayResponse<T> = {
  ok: boolean;
  result?: T;
  error?: string;
};

export type TelegramRequestStatus = {
  request_id: string;
  phone_number?: string;
  verification_status?: {
    status: string;
    code_entered?: string;
  };
};

@Injectable()
export class TelegramGatewayService implements OnModuleInit {
  private readonly logger = new Logger(TelegramGatewayService.name);
  private readonly baseUrl: string;
  private readonly token: string;

  constructor() {
    this.baseUrl = (process.env.TELEGRAM_GATEWAY_BASE_URL || 'https://gatewayapi.telegram.org').replace(
      /\/$/,
      '',
    );
    this.token = this.normalizeToken(process.env.TELEGRAM_GATEWAY_TOKEN);
  }

  onModuleInit() {
    if (!this.token) {
      this.logger.warn(
        'TELEGRAM_GATEWAY_TOKEN topilmadi — api/.env faylini tekshiring va serverni qayta ishga tushiring',
      );
      return;
    }
    this.logger.log(`Telegram Gateway token yuklandi (${this.maskToken(this.token)})`);
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

  isConfigured(): boolean {
    return Boolean(this.token);
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    if (!this.token) {
      throw new TelegramGatewayError('TOKEN_MISSING', 'Telegram Gateway token sozlanmagan');
    }

    const url = `${this.baseUrl}/${method}`;
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
      this.logger.error(`Telegram Gateway network error (${method})`, err);
      throw new TelegramGatewayError('NETWORK_ERROR', 'Telegram Gateway bilan bog\'lanib bo\'lmadi');
    }

    let data: GatewayResponse<T>;
    try {
      data = (await res.json()) as GatewayResponse<T>;
    } catch {
      throw new TelegramGatewayError('INVALID_RESPONSE', 'Telegram Gateway javobi noto\'g\'ri');
    }

    if (!data.ok) {
      const code = data.error || 'UNKNOWN_ERROR';
      this.logger.warn(`Telegram Gateway ${method} failed: ${code}`);
      throw new TelegramGatewayError(code, code, data);
    }

    if (!data.result) {
      throw new TelegramGatewayError('EMPTY_RESULT', 'Telegram Gateway bo\'sh javob qaytardi');
    }

    return data.result;
  }

  async sendVerificationMessage(params: {
    phoneNumber: string;
    code: string;
    ttlSeconds?: number;
  }): Promise<TelegramRequestStatus> {
    return this.call<TelegramRequestStatus>('sendVerificationMessage', {
      phone_number: params.phoneNumber,
      code: params.code,
      ttl: params.ttlSeconds ?? 300,
    });
  }

  async checkVerificationStatus(requestId: string, code?: string): Promise<TelegramRequestStatus> {
    return this.call<TelegramRequestStatus>('checkVerificationStatus', {
      request_id: requestId,
      ...(code ? { code } : {}),
    });
  }

  /** Telegram API xatolarini foydalanuvchiga tushunarli xabarga aylantiradi */
  mapErrorToUserMessage(code: string): { message: string; fallbackAvailable: boolean } {
    const upper = code.toUpperCase();

    if (
      upper.includes('PHONE') &&
      (upper.includes('NOT') || upper.includes('INVALID') || upper.includes('UNAVAILABLE'))
    ) {
      return {
        message: 'Bu raqam Telegram orqali tasdiqlanmaydi, boshqa usulni tanlang',
        fallbackAvailable: true,
      };
    }

    if (upper.includes('FLOOD') || upper.includes('LIMIT') || upper.includes('TOO_MANY')) {
      return {
        message: 'Limit tugadi. Birozdan keyin qayta urinib ko\'ring',
        fallbackAvailable: false,
      };
    }

    if (upper === 'TOKEN_MISSING' || upper === 'ACCESS_TOKEN_REQUIRED') {
      return {
        message: 'Telegram tasdiqlash xizmati sozlanmagan (server token yo\'q)',
        fallbackAvailable: false,
      };
    }

    if (upper === 'ACCESS_TOKEN_INVALID') {
      return {
        message: 'Telegram tasdiqlash xizmati sozlanmagan (token noto\'g\'ri)',
        fallbackAvailable: false,
      };
    }

    if (upper.includes('TOKEN') || upper.includes('ACCESS')) {
      return {
        message: 'Telegram tasdiqlash xizmati vaqtincha ishlamayapti',
        fallbackAvailable: false,
      };
    }

    return {
      message: 'Bu raqam Telegram\'ga bog\'lanmagan yoki xabar yuborib bo\'lmadi',
      fallbackAvailable: true,
    };
  }
}
