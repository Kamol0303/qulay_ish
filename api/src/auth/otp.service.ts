import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  private normalizePhone(input: string): string {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('998')) return `+${digits}`;
    if (digits.length === 9) return `+998${digits}`;
    return input.trim();
  }

  private async hashCode(code: string) {
    return bcrypt.hash(code, 10);
  }

  private async checkCode(code: string, hash: string) {
    return bcrypt.compare(code, hash);
  }

  async requestOtp(params: {
    phoneOrEmail: string;
    purpose: 'login' | 'register';
    fullName?: string;
    role?: UserRole;
  }) {
    const raw = params.phoneOrEmail.trim();
    const isEmail = raw.includes('@');
    const phone = isEmail ? null : this.normalizePhone(raw);
    const email = isEmail ? raw.toLowerCase() : null;

    if (params.purpose === 'register') {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(phone ? [{ phoneNumber: phone }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });
      if (existing) {
        throw new BadRequestException('Bu telefon yoki email allaqachon ro\'yxatdan o\'tgan');
      }
    } else {
      const existing = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(phone ? [{ phoneNumber: phone }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      });
      if (!existing) {
        throw new BadRequestException('Foydalanuvchi topilmadi. Avval ro\'yxatdan o\'ting');
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const sessionId = `otp_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpSession.create({
      data: {
        id: sessionId,
        phone,
        email,
        codeHash: await this.hashCode(code),
        purpose: params.purpose,
        fullName: params.fullName,
        role: params.role,
        expiresAt,
      },
    });

    // Dev: log OTP (Eskiz integration later)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP ${params.purpose}] ${phone || email}: ${code}`);
    }

    return { sessionId, ...(process.env.OTP_DEV_RETURN === 'true' ? { devCode: code } : {}) };
  }

  async verifyOtp(sessionId: string, otp: string) {
    const session = await this.prisma.otpSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('OTP sessiyasi topilmadi');
    if (session.completed) throw new BadRequestException('Sessiya allaqachon ishlatilgan');
    if (session.expiresAt < new Date()) throw new BadRequestException('OTP kodi eskirgan');
    if (session.attempts >= 5) throw new BadRequestException('Juda ko\'p xato urinish');

    const ok = await this.checkCode(otp, session.codeHash);
    if (!ok) {
      await this.prisma.otpSession.update({
        where: { id: sessionId },
        data: { attempts: session.attempts + 1 },
      });
      throw new BadRequestException('OTP kodi noto\'g\'ri');
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
