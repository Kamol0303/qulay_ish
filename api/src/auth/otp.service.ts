import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  GoneException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { DevSmsService, DevSmsError } from './devsms.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_MS,
  UZ_PHONE_E164,
} from './otp.constants';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly devSms: DevSmsService,
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
      throw new BadRequestException('Telefon raqami +998XXXXXXXXX formatida bo\'lishi kerak');
    }
  }

  private async hashCode(code: string) {
    return bcrypt.hash(code, 10);
  }

  private async checkCode(code: string, hash: string) {
    return bcrypt.compare(code, hash);
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
        'Bir daqiqada faqat bitta OTP so\'rov yuborish mumkin',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private throwSmsError(err: unknown): never {
    if (err instanceof DevSmsError) {
      this.logger.warn(`DevSMS xatosi: ${err.code} — ${err.message}`);
      throw new BadRequestException(`SMS yuborib bo'lmadi: ${err.message}`);
    }
    this.logger.error('DevSMS noma\'lum xato', err);
    throw new BadRequestException('SMS yuborib bo\'lmadi. Birozdan keyin qayta urinib ko\'ring');
  }

  /** POST /auth/send-otp — SMS only when needed (prefer password auth; reset uses OTP) */
  async sendOtp(dto: SendOtpDto): Promise<{ success: true }> {
    const phone = this.normalizePhone(dto.phone);
    this.validateE164Phone(phone);
    await this.assertRateLimit(phone);

    const purpose = dto.purpose || 'login';

    // Never accept privileged roles from public OTP registration
    const safeRole =
      purpose === 'register'
        ? dto.role === 'employer'
          ? UserRole.employer
          : UserRole.worker
        : undefined;

    let existingMeta: { passwordHash?: string; purpose?: string } | undefined;

    if (purpose === 'register') {
      const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
      if (existing) {
        throw new BadRequestException('Bu telefon raqami allaqachon ro\'yxatdan o\'tgan');
      }
      if (!dto.fullName || dto.fullName.trim().length < 2) {
        throw new BadRequestException('To\'liq ism majburiy');
      }
      if (!dto.password || dto.password.length < 8) {
        throw new BadRequestException('Parol kamida 8 ta belgidan iborat bo\'lishi kerak');
      }
      existingMeta = { passwordHash: await bcrypt.hash(dto.password, 10) };
    } else if (purpose === 'reset') {
      const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
      if (!existing) {
        throw new BadRequestException(
          'Bu telefon raqami ro\'yxatdan o\'tmagan. Avval ro\'yxatdan o\'ting.',
        );
      }
      existingMeta = { purpose: 'reset' };
    } else {
      // Legacy login OTP: unregistered phones must not receive SMS
      const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
      if (!existing) {
        throw new BadRequestException(
          'Bu telefon raqami ro\'yxatdan o\'tmagan. Avval ro\'yxatdan o\'ting.',
        );
      }
    }

    const code = this.generateCode();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const codeHash = await this.hashCode(code);

    await this.prisma.otpSession.deleteMany({
      where: { phone, verified: false, completed: false },
    });

    await this.prisma.otpSession.create({
      data: {
        id: sessionId,
        phone,
        codeHash,
        purpose,
        fullName: dto.fullName?.trim(),
        role: safeRole,
        channel: 'sms',
        attempts: 0,
        verified: false,
        expiresAt,
        metadata: existingMeta,
      },
    });

    try {
      const smsMeta = await this.devSms.sendOtpSms(phone, code, purpose);
      await this.prisma.otpSession.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...(existingMeta || {}),
            smsId: smsMeta.smsId,
            requestId: smsMeta.requestId,
          } as object,
        },
      });
    } catch (err) {
      await this.prisma.otpSession.delete({ where: { id: sessionId } }).catch(() => undefined);
      this.throwSmsError(err);
    }

    return { success: true };
  }

  /** POST /auth/verify-otp — spec */
  async verifyOtpByPhone(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    this.validateE164Phone(phone);

    const session = await this.prisma.otpSession.findFirst({
      where: { phone, verified: false, completed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new NotFoundException('Session topilmadi, qayta OTP so\'rang');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.otpSession.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new GoneException('OTP muddati tugagan');
    }

    if (session.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { completed: true },
      });
      throw new HttpException(
        {
          message: 'Urinishlar soni tugadi, yangi OTP so\'rang',
          remainingAttempts: 0,
          maxAttempts: OTP_MAX_ATTEMPTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ok = await this.checkCode(dto.code, session.codeHash);
    if (!ok) {
      const attempts = session.attempts + 1;
      const exhausted = attempts >= OTP_MAX_ATTEMPTS;
      await this.prisma.otpSession.update({
        where: { id: session.id },
        data: { attempts, ...(exhausted ? { completed: true } : {}) },
      });
      if (exhausted) {
        throw new HttpException(
          {
            message: 'Urinishlar soni tugadi, yangi OTP so\'rang',
            remainingAttempts: 0,
            maxAttempts: OTP_MAX_ATTEMPTS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException({
        message: 'OTP kodi noto\'g\'ri',
        remainingAttempts: OTP_MAX_ATTEMPTS - attempts,
        maxAttempts: OTP_MAX_ATTEMPTS,
      });
    }

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { verified: true },
    });

    const purpose = session.purpose || 'login';

    // Password recovery: OTP proves phone ownership; do NOT issue a login session.
    // Client then calls POST /auth/reset-password with the new password.
    if (purpose === 'reset') {
      return {
        success: true,
        purpose: 'reset' as const,
        resetAllowed: true,
      };
    }

    let user = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });

    if (!user) {
      // Never auto-create accounts on login OTP
      if (purpose !== 'register') {
        throw new UnauthorizedException(
          'Bu telefon raqami ro\'yxatdan o\'tmagan. Avval ro\'yxatdan o\'ting.',
        );
      }
      const uid = randomUUID().replace(/-/g, '').slice(0, 28);
      const email = `${phone.replace(/\D/g, '')}@ishliayol.uz`;
      const meta = (session.metadata && typeof session.metadata === 'object'
        ? session.metadata
        : {}) as { passwordHash?: string };
      if (!meta.passwordHash) {
        throw new BadRequestException(
          'Parol topilmadi. Ro\'yxatdan o\'tishni qaytadan boshlang va OTP oling.',
        );
      }
      // Only worker/employer may be created via public OTP registration
      const role =
        session.role === UserRole.employer ? UserRole.employer : UserRole.worker;
      user = await this.prisma.user.create({
        data: {
          id: uid,
          fullName: (session.fullName || 'User').trim(),
          email,
          phoneNumber: phone,
          role,
          passwordHash: meta.passwordHash,
          region: 'Samarqand viloyati',
          isVerified: false,
          verificationStatus: 'none',
        },
      });
    }

    const tokenResult = this.auth.signToken(user);

    await this.prisma.otpSession.delete({ where: { id: session.id } }).catch(() => undefined);

    return {
      success: true,
      accessToken: tokenResult.accessToken,
      user: {
        ...tokenResult.user,
        phone: user.phoneNumber,
      },
    };
  }

  /** After reset OTP is verified — set a new password (no auto-login). */
  async resetPassword(data: { phone: string; newPassword: string }) {
    const phone = this.normalizePhone(data.phone);
    this.validateE164Phone(phone);

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new BadRequestException('Parol kamida 8 ta belgidan iborat bo\'lishi kerak');
    }

    const session = await this.prisma.otpSession.findFirst({
      where: {
        phone,
        purpose: 'reset',
        verified: true,
        completed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new BadRequestException(
        'Avval telefon raqamingizni OTP orqali tasdiqlang',
      );
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.otpSession.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new GoneException('OTP muddati tugagan. Qayta so\'rang');
    }

    const user = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(data.newPassword, 10) },
    });

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { completed: true },
    });
    await this.prisma.otpSession
      .deleteMany({ where: { phone, purpose: 'reset' } })
      .catch(() => undefined);

    return { success: true as const, message: 'Parol muvaffaqiyatli yangilandi' };
  }

  async registerWithPassword(data: {
    email?: string;
    password: string;
    fullName: string;
    role: 'worker' | 'employer' | UserRole;
    phone?: string;
    phoneNumber?: string;
  }) {
    if (!data.password || data.password.length < 8) {
      throw new BadRequestException('Parol kamida 8 ta belgidan iborat bo\'lishi kerak');
    }
    const role = String(data.role) === 'employer' ? UserRole.employer : UserRole.worker;
    const fullName = data.fullName.trim();
    if (fullName.length < 2) {
      throw new BadRequestException('Ism kamida 2 ta belgidan iborat bo\'lishi kerak');
    }

    const rawPhone = data.phoneNumber || data.phone;
    if (!rawPhone) {
      throw new BadRequestException('Telefon raqami majburiy');
    }
    const phoneNumber = this.normalizePhone(rawPhone);
    this.validateE164Phone(phoneNumber);

    const email = (data.email?.trim() || `${phoneNumber.replace(/\D/g, '')}@qulayish.local`).toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });
    if (existing) {
      throw new BadRequestException(
        existing.phoneNumber === phoneNumber
          ? 'Bu telefon raqami allaqachon ro\'yxatdan o\'tgan'
          : 'Allaqachon ro\'yxatdan o\'tgan',
      );
    }

    const uid = randomUUID().replace(/-/g, '').slice(0, 28);
    const user = await this.prisma.user.create({
      data: {
        id: uid,
        email,
        phoneNumber,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName,
        role,
        region: 'Samarqand viloyati',
      },
    });
    return this.auth.signToken(user);
  }
}
