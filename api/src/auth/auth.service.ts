import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(emailOrPhone: string, password: string): Promise<User> {
    const normalized = emailOrPhone.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { phoneNumber: normalized },
        ],
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async superAdminLogin(login: string, password: string): Promise<User> {
    const envEmail = (process.env.SUPER_ADMIN_EMAIL || process.env.VITE_SUPER_ADMIN_EMAIL || '').trim();
    const envPhone = (process.env.SUPER_ADMIN_PHONE || process.env.VITE_SUPER_ADMIN_PHONE || '').trim();
    const envPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.VITE_SUPER_ADMIN_PASSWORD || '';

    if (!envPassword || (!envEmail && !envPhone)) {
      throw new UnauthorizedException('Super Admin serverda sozlanmagan (api/.env)');
    }
    if (!login?.trim() || !password) {
      throw new UnauthorizedException('Login va parol majburiy');
    }

    const normalizedLogin = login.trim();
    const loginDigits = normalizedLogin.replace(/\D/g, '');
    const envPhoneDigits = envPhone.replace(/\D/g, '');
    const loginOk =
      (envEmail && normalizedLogin.toLowerCase() === envEmail.toLowerCase()) ||
      (envPhone && (
        normalizedLogin.replace(/\s+/g, '') === envPhone.replace(/\s+/g, '') ||
        (loginDigits.length >= 9 && envPhoneDigits.endsWith(loginDigits))
      ));

    if (!loginOk || password !== envPassword) {
      throw new UnauthorizedException('Super Admin login yoki parol noto\'g\'ri');
    }

    const email = envEmail || 'superadmin@ishliayol.uz';

    try {
      let user = await this.prisma.user.findFirst({
        where: { role: UserRole.super_admin },
      });

      if (user) {
        // Keep password hash in sync with api/.env for local/dev convenience
        const hash = await bcrypt.hash(envPassword, 10);
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            passwordHash: hash,
            isVerified: true,
            verificationStatus: 'verified',
          },
        });
        return user;
      }

      // phoneNumber is UNIQUE — do not attach env phone if another user already owns it
      let phoneNumber: string | null = envPhone || null;
      if (phoneNumber) {
        const taken = await this.prisma.user.findFirst({
          where: { phoneNumber },
          select: { id: true, role: true },
        });
        if (taken) phoneNumber = null;
      }

      user = await this.prisma.user.create({
        data: {
          id: `super_admin_${Date.now()}`,
          email,
          phoneNumber,
          fullName: 'Super Admin',
          role: UserRole.super_admin,
          region: 'Samarqand viloyati',
          passwordHash: await bcrypt.hash(envPassword, 10),
          isVerified: true,
          verificationStatus: 'verified',
        },
      });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Can't reach database") || message.includes('P1001')) {
        throw new UnauthorizedException('Database ishlamayapti (PostgreSQL localhost:5432)');
      }
      throw new UnauthorizedException(`Super Admin kirish xatosi: ${message}`);
    }
  }

  signToken(user: User) {
    const payload: JwtPayload = { sub: user.id, role: user.role, email: user.email };
    return {
      accessToken: this.jwt.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  sanitizeUser(user: User) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitizeUser(user);
  }
}
