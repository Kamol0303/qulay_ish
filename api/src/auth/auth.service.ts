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

  async superAdminLogin(email: string, password: string): Promise<User> {
    const envEmail = process.env.SUPER_ADMIN_EMAIL || process.env.VITE_SUPER_ADMIN_EMAIL;
    const envPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.VITE_SUPER_ADMIN_PASSWORD;
    if (!envEmail || !envPassword || email !== envEmail || password !== envPassword) {
      throw new UnauthorizedException('Invalid super admin credentials');
    }
    let user = await this.prisma.user.findFirst({
      where: { role: UserRole.super_admin },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: `super_admin_${Date.now()}`,
          email: envEmail,
          fullName: 'Super Admin',
          role: UserRole.super_admin,
          region: 'Samarqand viloyati',
          passwordHash: await bcrypt.hash(envPassword, 10),
          isVerified: true,
          verificationStatus: 'verified',
        },
      });
    }
    return user;
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
