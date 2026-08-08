import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { User, UserRole } from '@prisma/client';

const SUPER_ADMIN_ENV_KEYS = [
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PHONE',
  'SUPER_ADMIN_PASSWORD',
  'VITE_SUPER_ADMIN_EMAIL',
  'VITE_SUPER_ADMIN_PHONE',
  'VITE_SUPER_ADMIN_PASSWORD',
] as const;

/** Re-read only Super Admin keys from api/.env (no full env override). */
function reloadSuperAdminEnvFromDisk(): void {
  const candidates = [
    join(__dirname, '..', '.env'),
    join(process.cwd(), '.env'),
    join(process.cwd(), 'api', '.env'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const parsed = dotenv.parse(readFileSync(path));
    for (const key of SUPER_ADMIN_ENV_KEYS) {
      if (parsed[key] !== undefined) process.env[key] = parsed[key];
    }
    return;
  }
}

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

  private normalizePhoneLookup(input: string): string[] {
    const trimmed = input.trim();
    const digits = trimmed.replace(/\D/g, '');
    const variants = new Set<string>([trimmed]);
    if (digits.startsWith('998') && digits.length === 12) {
      variants.add(`+${digits}`);
    }
    if (digits.length === 9) {
      variants.add(`+998${digits}`);
    }
    if (digits.length === 12) {
      variants.add(digits);
    }
    return [...variants];
  }

  async validateUser(emailOrPhone: string, password: string): Promise<User> {
    const normalized = emailOrPhone.trim();
    const phoneVariants = this.normalizePhoneLookup(normalized);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: normalized },
          { email: normalized.toLowerCase() },
          ...phoneVariants.map((phoneNumber) => ({ phoneNumber })),
        ],
      },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Telefon yoki parol noto\'g\'ri');
    }
    if (user.isBlocked) {
      if (!user.blockUntil || user.blockUntil > new Date()) {
        throw new UnauthorizedException('Hisobingiz bloklangan');
      }
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Telefon yoki parol noto\'g\'ri');
    return user;
  }

  private phoneMatches(login: string, phone: string): boolean {
    if (!phone) return false;
    const loginNorm = login.replace(/\s+/g, '');
    const phoneNorm = phone.replace(/\s+/g, '');
    if (loginNorm === phoneNorm) return true;
    const loginDigits = login.replace(/\D/g, '');
    const phoneDigits = phone.replace(/\D/g, '');
    return loginDigits.length >= 9 && phoneDigits.endsWith(loginDigits);
  }

  async superAdminLogin(login: string, password: string): Promise<User> {
    reloadSuperAdminEnvFromDisk();
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

    try {
      let user = await this.prisma.user.findFirst({
        where: { role: UserRole.super_admin },
      });

      // Accept env credentials OR the existing super_admin row (covers email rename in .env
      // while a long-running API still has stale process.env until restart).
      const loginOk =
        (envEmail && normalizedLogin.toLowerCase() === envEmail.toLowerCase()) ||
        this.phoneMatches(normalizedLogin, envPhone) ||
        (!!user?.email && normalizedLogin.toLowerCase() === user.email.toLowerCase()) ||
        (!!user?.phoneNumber && this.phoneMatches(normalizedLogin, user.phoneNumber));

      if (!loginOk || password !== envPassword) {
        throw new UnauthorizedException('Super Admin login yoki parol noto\'g\'ri');
      }

      const email = envEmail || user?.email || 'superadmin@mexrliqollar.uz';

      if (user) {
        // Keep password hash / identity in sync with api/.env for local/dev convenience
        const hash = await bcrypt.hash(envPassword, 10);
        let phoneNumber: string | null | undefined = undefined;
        if (envPhone && user.phoneNumber !== envPhone) {
          const taken = await this.prisma.user.findFirst({
            where: { phoneNumber: envPhone, NOT: { id: user.id } },
            select: { id: true },
          });
          if (!taken) phoneNumber = envPhone;
        }
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            ...(phoneNumber !== undefined ? { phoneNumber } : {}),
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
      if (err instanceof UnauthorizedException) throw err;
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
