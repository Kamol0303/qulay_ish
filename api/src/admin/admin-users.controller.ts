import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UZ_PHONE_E164 } from '../auth/otp.constants';
import { normalizeNameInput } from '../common/name.util';
import { CreateAdminDto } from './dto/create-admin.dto';

type AuthUser = { userId: string; role: string };

const STAFF_ROLES = ['admin', 'super_admin'] as const;

/**
 * Super Admin-only staff management: create/list/remove admin (and super_admin)
 * accounts and set their login password. Public registration can never create
 * these roles — this controller is the only way to add staff.
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly prisma: PrismaService) {}

  private sanitize(u: Record<string, any>) {
    return {
      uid: u.id,
      fullName: u.fullName,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phoneNumber: u.phoneNumber,
      role: u.role,
      isVerified: u.isVerified,
      isBlocked: u.isBlocked,
      createdAt: u.createdAt,
    };
  }

  private normalizePhone(input: string): string {
    const digits = (input || '').replace(/\D/g, '');
    if (digits.length === 9) return `+998${digits}`;
    if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
    return (input || '').trim();
  }

  /** List all admin / super_admin accounts (newest first). */
  @Get()
  async list() {
    const rows = await this.prisma.user.findMany({
      where: { role: { in: STAFF_ROLES as unknown as string[] } as any },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.sanitize(r as Record<string, any>));
  }

  /** Create a new staff account with a login (phone) + password. */
  @Post()
  async create(@Body() dto: CreateAdminDto, @Req() req: { user: AuthUser }) {
    const phone = this.normalizePhone(dto.phone);
    if (!UZ_PHONE_E164.test(phone)) {
      throw new BadRequestException('Telefon raqami +998XXXXXXXXX formatida boʻlishi kerak');
    }
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Parol kamida 8 ta belgidan iborat boʻlishi kerak');
    }

    const existing = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (existing) {
      throw new BadRequestException('Bu telefon raqami allaqachon roʻyxatdan oʻtgan');
    }

    const role = dto.role === 'super_admin' ? 'super_admin' : 'admin';
    const { firstName, lastName, fullName } = normalizeNameInput({ fullName: dto.fullName });
    if (!fullName || fullName.length < 2) {
      throw new BadRequestException('Ism kamida 2 ta belgidan iborat boʻlishi kerak');
    }
    const email = (dto.email?.trim() || `${phone.replace(/\D/g, '')}@mexrliqollar.uz`).toLowerCase();

    const uid = randomUUID().replace(/-/g, '').slice(0, 28);
    const user = await this.prisma.user.create({
      data: {
        id: uid,
        fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        email,
        phoneNumber: phone,
        role: role as any,
        passwordHash: await bcrypt.hash(dto.password, 10),
        region: 'Samarqand viloyati',
        isVerified: true,
        verificationStatus: 'verified',
      },
    });

    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'ADMIN_USER_CREATED',
          userId: req.user.userId,
          details: { createdUserId: uid, role, phone },
          type: 'info',
        },
      })
      .catch(() => undefined);

    return this.sanitize(user as Record<string, any>);
  }

  /** Reset a staff account's login password. */
  @Patch(':id/password')
  async resetPassword(
    @Param('id') id: string,
    @Body() body: { password?: string },
    @Req() req: { user: AuthUser },
  ) {
    const password = String(body?.password || '');
    if (password.length < 8) {
      throw new BadRequestException('Parol kamida 8 ta belgidan iborat boʻlishi kerak');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || !(STAFF_ROLES as readonly string[]).includes(target.role)) {
      throw new NotFoundException('Admin foydalanuvchi topilmadi');
    }
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'ADMIN_PASSWORD_RESET',
          userId: req.user.userId,
          details: { targetUserId: id },
          type: 'warning',
        },
      })
      .catch(() => undefined);
    return { success: true };
  }

  /** Remove a staff account (cannot delete yourself). */
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    if (id === req.user.userId) {
      throw new BadRequestException('Oʻzingizni oʻchira olmaysiz');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || !(STAFF_ROLES as readonly string[]).includes(target.role)) {
      throw new NotFoundException('Admin foydalanuvchi topilmadi');
    }
    await this.prisma.user.delete({ where: { id } });
    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'ADMIN_USER_DELETED',
          userId: req.user.userId,
          details: { targetUserId: id, role: target.role },
          type: 'warning',
        },
      })
      .catch(() => undefined);
    return { success: true };
  }
}
