import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { VerificationStatus } from '@prisma/client';

type AuthUser = { userId: string; role: string; email?: string };

function isSuper(role: string) {
  return role === 'super_admin';
}

function toUserView(row: Record<string, unknown>) {
  const { adminNotes: _a, reviewedBy: _r, ...rest } = row;
  return rest;
}

@Controller('verification-requests')
export class VerificationRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Own request (user) or filtered list (super_admin) */
  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Req() req: { user: AuthUser },
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('accountType') accountType?: string,
    @Query('region') region?: string,
  ) {
    if (isSuper(req.user.role)) {
      const rows = await this.prisma.verificationRequest.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(status ? { status: status as VerificationStatus } : {}),
          ...(accountType ? { accountType } : {}),
          ...(region
            ? { user: { region: { contains: region, mode: 'insensitive' } } }
            : {}),
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              role: true,
              region: true,
              district: true,
              phoneNumber: true,
              email: true,
              photoUrl: true,
              companyName: true,
              verificationStatus: true,
              isVerified: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows;
    }

    // Regular users: only own requests, no internal admin fields
    const rows = await this.prisma.verificationRequest.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toUserView(r as unknown as Record<string, unknown>));
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  async mine(@Req() req: { user: AuthUser }) {
    const row = await this.prisma.verificationRequest.findFirst({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
    return row ? toUserView(row as unknown as Record<string, unknown>) : null;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: { user: AuthUser }, @Body() body: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    const open = await this.prisma.verificationRequest.findFirst({
      where: {
        userId: req.user.userId,
        status: { in: ['pending', 'under_review'] },
      },
    });
    if (open) {
      throw new BadRequestException('Sizda allaqachon ko\'rib chiqilayotgan ariza bor');
    }

    const idPhotoUrl = String(body.idPhotoUrl || body.documentUrl || '');
    const selfieUrl = String(body.selfieUrl || '');
    if (!idPhotoUrl || !selfieUrl) {
      throw new BadRequestException('ID hujjat va selfi majburiy');
    }
    if (!idPhotoUrl.includes('/api/uploads/private/')) {
      throw new BadRequestException('Hujjatlar xavfsiz yuklash orqali yuborilishi kerak');
    }

    const id = randomUUID();
    const created = await this.prisma.verificationRequest.create({
      data: {
        id,
        userId: req.user.userId,
        userName: user.fullName,
        accountType: user.role === 'employer' ? 'employer' : 'worker',
        documentType: (body.documentType as string) || 'id_card',
        idPhotoUrl,
        documentUrl: idPhotoUrl,
        selfieUrl,
        addressProofUrl: (body.addressProofUrl as string) || null,
        additionalFiles: (body.additionalFiles as object) || undefined,
        status: 'pending',
        rejectionReason: null,
        reviewNote: null,
        adminNotes: null,
        reviewedBy: null,
        approvedAt: null,
      },
    });

    await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { verificationStatus: 'pending', isVerified: false },
    });

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: req.user.userId,
        title: 'Tasdiqlash yuborildi',
        message: 'Shaxsni tasdiqlash arizangiz qabul qilindi. Ko\'rib chiqish kutilmoqda.',
        type: 'system',
        link: '/verification',
        read: false,
      },
    });

    return toUserView(created as unknown as Record<string, unknown>);
  }

  /** User can replace docs when rejected / need_reupload; cannot approve */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const existing = await this.prisma.verificationRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ariza topilmadi');

    if (isSuper(req.user.role)) {
      return this.superAdminUpdate(existing.id, existing.userId, body, req.user);
    }

    if (existing.userId !== req.user.userId) throw new ForbiddenException();

    const allowedResubmit = ['rejected', 'need_reupload'].includes(existing.status);
    if (!allowedResubmit) {
      throw new ForbiddenException('Hozirgi holatda hujjatlarni o\'zgartirish mumkin emas');
    }

    const data: Record<string, unknown> = {
      status: 'pending',
      rejectionReason: null,
      reviewNote: null,
      reviewedBy: null,
      approvedAt: null,
    };
    for (const key of ['idPhotoUrl', 'documentUrl', 'selfieUrl', 'addressProofUrl', 'additionalFiles', 'documentType']) {
      if (key in body) data[key] = body[key];
    }

    const updated = await this.prisma.verificationRequest.update({ where: { id }, data: data as any });
    await this.prisma.user.update({
      where: { id: req.user.userId },
      data: { verificationStatus: 'pending', isVerified: false },
    });
    return toUserView(updated as unknown as Record<string, unknown>);
  }

  private async superAdminUpdate(
    id: string,
    userId: string,
    body: Record<string, unknown>,
    admin: AuthUser,
  ) {
    const action = String(body.action || body.status || '');
    const data: Record<string, unknown> = {};

    if ('adminNotes' in body) data.adminNotes = body.adminNotes;
    if ('reviewNote' in body) data.reviewNote = body.reviewNote;
    if ('rejectionReason' in body) data.rejectionReason = body.rejectionReason;

    if (action === 'under_review' || body.status === 'under_review') {
      data.status = 'under_review';
      data.reviewedBy = admin.userId;
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'under_review' },
      });
    } else if (action === 'approve' || body.status === 'verified' || body.status === 'approved') {
      data.status = 'verified';
      data.reviewedBy = admin.userId;
      data.approvedAt = new Date();
      data.rejectionReason = null;
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'verified', isVerified: true },
      });
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId,
          title: 'Tasdiqlash muvaffaqiyatli',
          message: 'Sizning hisobingiz Qulay Ish tomonidan tasdiqlandi!',
          type: 'system',
          link: '/my-profile',
          read: false,
        },
      });
    } else if (action === 'reject' || body.status === 'rejected') {
      const reason = String(body.rejectionReason || body.reviewNote || 'Hujjatlar talabga javob bermadi');
      data.status = 'rejected';
      data.reviewedBy = admin.userId;
      data.rejectionReason = reason;
      data.reviewNote = reason;
      data.approvedAt = null;
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'rejected', isVerified: false },
      });
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId,
          title: 'Tasdiqlash rad etildi',
          message: `Sabab: ${reason}`,
          type: 'system',
          link: '/verification',
          read: false,
        },
      });
    } else if (action === 'need_reupload' || body.status === 'need_reupload') {
      const reason = String(body.rejectionReason || body.reviewNote || 'Iltimos, hujjatlarni qayta yuklang');
      data.status = 'need_reupload';
      data.reviewedBy = admin.userId;
      data.rejectionReason = reason;
      data.reviewNote = reason;
      await this.prisma.user.update({
        where: { id: userId },
        data: { verificationStatus: 'need_reupload', isVerified: false },
      });
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId,
          title: 'Qo\'shimcha hujjat so\'raldi',
          message: reason,
          type: 'system',
          link: '/verification',
          read: false,
        },
      });
    } else if (!Object.keys(data).length) {
      throw new BadRequestException('Noto\'g\'ri amal');
    }

    return this.prisma.verificationRequest.update({ where: { id }, data: data as any });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('bulk')
  async bulk(@Body() body: { ids?: string[]; action?: 'approve' | 'reject'; reason?: string }, @Req() req: { user: AuthUser }) {
    const ids = body.ids || [];
    if (!ids.length) throw new BadRequestException('ids majburiy');
    const results: unknown[] = [];
    for (const id of ids) {
      const row = await this.prisma.verificationRequest.findUnique({ where: { id } });
      if (!row) continue;
      results.push(
        await this.superAdminUpdate(
          id,
          row.userId,
          {
            action: body.action,
            rejectionReason: body.reason,
          },
          req.user,
        ),
      );
    }
    return { success: true, count: results.length, results };
  }
}
