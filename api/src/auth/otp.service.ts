import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { TelegramGatewayService, TelegramGatewayError } from './telegram-gateway.service';
import {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_LOCK_MS,
  OTP_RATE_LIMIT_MS,
  UZ_PHONE_E164,
} from './otp.constants';

type OtpChannel = 'telegram' | 'email';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly telegram: TelegramGatewayService,
  ) {}

  private normalizePhone(input: string): string {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
    if (digits.length === 9) return `+998${digits}`;
    const trimmed = input.trim();
    if (trimmed.startsWith('+')) return trimmed;
    return trimmed;
  }

  private validateE164Phone(phone: string): void {
    if (!UZ_PHONE_E164.test(phone)) {
      throw new BadRequestException({
        message: 'Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak',
        errorCode: 'INVALID_PHONE_FORMAT',
        fallbackAvailable: false,
      });
    }
  }

  private async hashCode(code: string) {
    return bcrypt.hash(code, 10);
  }

  private async checkCode(code: string, hash: string) {
    return bcrypt.compare(code, hash);
  }

  private async assertPhoneNotLocked(phone: string) {
    const lock = await this.prisma.otpPhoneLock.findUnique({ where: { phone } });
    if (lock && lock.lockedUntil > new Date()) {
      const minutes = Math.ceil((lock.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        {
          message: `Juda ko'p noto'g'ri urinish. ${minutes} daqiqadan keyin qayta urinib ko'ring`,
          errorCode: 'OTP_LOCKED',
          fallbackAvailable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async assertRateLimit(phone: string) {
    const recent = await this.prisma.otpSession.findFirst({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - OTP_RATE_LIMIT_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        {
          message: 'Bir daqiqada faqat bitta OTP so\'rov yuborish mumkin',
          errorCode: 'RATE_LIMIT',
          fallbackAvailable: false,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async lockPhone(phone: string) {
    const lockedUntil = new Date(Date.now() + OTP_LOCK_MS);
    await this.prisma.otpPhoneLock.upsert({
      where: { phone },
      create: { phone, lockedUntil },
      update: { lockedUntil },
    });
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private throwTelegramError(err: TelegramGatewayError): never {
    const mapped = this.telegram.mapErrorToUserMessage(err.code);
    throw new BadRequestException({
      message: mapped.message,
      errorCode: 'TELEGRAM_UNAVAILABLE',
      fallbackAvailable: mapped.fallbackAvailable,
    });
  }

  async requestOtp(params: {
    phoneOrEmail: string;
    purpose: 'login' | 'register';
    fullName?: string;
    role?: UserRole;
    channel?: OtpChannel;
  }) {
    const raw = params.phoneOrEmail.trim();
    const requestedChannel: OtpChannel = params.channel === 'email' ? 'email' : 'telegram';
    const isEmailInput = raw.includes('@');

    if (requestedChannel === 'telegram' && isEmailInput) {
      throw new BadRequestException({
        message: 'Telegram OTP uchun telefon raqamini kiriting (+998...)',
        errorCode: 'PHONE_REQUIRED',
        fallbackAvailable: false,
      });
    }

    if (isEmailInput || requestedChannel === 'email') {
      throw new BadRequestException({
        message:
          'Email orqali tasdiqlash hozircha mavjud emas. Telegram bilan bog\'langan telefon raqamidan foydalaning.',
        errorCode: 'EMAIL_NOT_AVAILABLE',
        fallbackAvailable: false,
      });
    }

    const phone = this.normalizePhone(raw);
    this.validateE164Phone(phone);

    await this.assertPhoneNotLocked(phone);
    await this.assertRateLimit(phone);

    if (params.purpose === 'register') {
      const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
      if (existing) {
        throw new BadRequestException('Bu telefon raqami allaqachon ro\'yxatdan o\'tgan');
      }
    } else {
      const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
      if (!existing) {
        throw new BadRequestException('Foydalanuvchi topilmadi. Avval ro\'yxatdan o\'ting');
      }
    }

    const code = this.generateCode();
    const sessionId = `otp_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    let telegramRequestId: string | null = null;
    try {
      const result = await this.telegram.sendVerificationMessage({
        phoneNumber: phone,
        code,
        ttlSeconds: OTP_TTL_MS / 1000,
      });
      telegramRequestId = result.request_id;
    } catch (err) {
      if (err instanceof TelegramGatewayError) {
        this.throwTelegramError(err);
      }
      throw new BadRequestException({
        message: 'Telegram orqali OTP yuborib bo\'lmadi',
        errorCode: 'TELEGRAM_UNAVAILABLE',
        fallbackAvailable: true,
      });
    }

    await this.prisma.otpSession.create({
      data: {
        id: sessionId,
        phone,
        codeHash: await this.hashCode(code),
        purpose: params.purpose,
        fullName: params.fullName,
        role: params.role,
        channel: 'telegram',
        telegramRequestId,
        expiresAt,
      },
    });

    return {
      sessionId,
      channel: 'telegram' as const,
      message: 'OTP kodi Telegram orqali yuborildi',
    };
  }

  async verifyOtp(sessionId: string, otp: string) {
    const session = await this.prisma.otpSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('OTP sessiyasi topilmadi');
    if (session.completed) throw new BadRequestException('Sessiya allaqachon ishlatilgan');
    if (session.expiresAt < new Date()) throw new BadRequestException('OTP kodi eskirgan');
    if (session.attempts >= OTP_MAX_ATTEMPTS) {
      if (session.phone) await this.lockPhone(session.phone);
      throw new HttpException(
        {
          message: 'Juda ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring',
          errorCode: 'OTP_LOCKED',
          fallbackAvailable: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (session.phone) {
      await this.assertPhoneNotLocked(session.phone);
    }

    const ok = await this.checkCode(otp, session.codeHash);
    if (!ok) {
      const attempts = session.attempts + 1;
      await this.prisma.otpSession.update({
        where: { id: sessionId },
        data: { attempts },
      });
      if (attempts >= OTP_MAX_ATTEMPTS && session.phone) {
        await this.lockPhone(session.phone);
        throw new HttpException(
          {
            message: 'Juda ko\'p noto\'g\'ri urinish. 15 daqiqadan keyin qayta urinib ko\'ring',
            errorCode: 'OTP_LOCKED',
            fallbackAvailable: true,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadRequestException('OTP kodi noto\'g\'ri');
    }

    if (session.channel === 'telegram' && session.telegramRequestId) {
      try {
        await this.telegram.checkVerificationStatus(session.telegramRequestId, otp);
      } catch {
        // Telegram status tekshiruvi muvaffaqiyatsiz bo'lsa ham lokal tasdiqlash yetarli
      }
    }

    await this.prisma.otpSession.update({
      where: { id: sessionId },
      data: { verified: true },
    });

    return { success: true };
  }

  async completeRegistration(
    sessionId: string,
    data?: { email?: string; phoneNumber?: string },
  ) {
    const session = await this.prisma.otpSession.findUnique({ where: { id: sessionId } });
    if (!session?.verified || session.purpose !== 'register') {
      throw new UnauthorizedException('OTP tasdiqlanmagan');
    }

    const phone = data?.phoneNumber || session.phone;
    const email = data?.email || session.email || `${(phone || 'user').replace(/\D/g, '')}@qulayish.local`;
    const uid = randomUUID().replace(/-/g, '').slice(0, 28);

    const user = await this.prisma.user.create({
      data: {
        id: uid,
        fullName: session.fullName || 'User',
        email,
        phoneNumber: phone,
        role: session.role || UserRole.worker,
        region: 'Samarqand viloyati',
        isVerified: true,
        verificationStatus: 'verified',
        telegramVerified: session.channel === 'telegram' && Boolean(session.phone),
      },
    });

    await this.prisma.otpSession.update({
      where: { id: sessionId },
      data: { completed: true, uid: user.id },
    });

    return this.auth.signToken(user);
  }

  async completeLogin(sessionId: string) {
    const session = await this.prisma.otpSession.findUnique({ where: { id: sessionId } });
    if (!session?.verified || session.purpose !== 'login') {
      throw new UnauthorizedException('OTP tasdiqlanmagan');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          ...(session.phone ? [{ phoneNumber: session.phone }] : []),
          ...(session.email ? [{ email: session.email }] : []),
        ],
      },
    });
    if (!user) throw new UnauthorizedException('Foydalanuvchi topilmadi');

    if (session.channel === 'telegram' && session.phone) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramVerified: true },
      });
    }

    await this.prisma.otpSession.update({
      where: { id: sessionId },
      data: { completed: true, uid: user.id },
    });

    return this.auth.signToken(user);
  }

  async registerWithPassword(data: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    phoneNumber?: string;
  }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, ...(data.phoneNumber ? [{ phoneNumber: data.phoneNumber }] : [])] },
    });
    if (existing) throw new BadRequestException('Allaqachon ro\'yxatdan o\'tgan');

    const uid = randomUUID().replace(/-/g, '').slice(0, 28);
    const user = await this.prisma.user.create({
      data: {
        id: uid,
        email: data.email,
        phoneNumber: data.phoneNumber,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName,
        role: data.role,
        region: 'Samarqand viloyati',
      },
    });
    return this.auth.signToken(user);
  }
}
