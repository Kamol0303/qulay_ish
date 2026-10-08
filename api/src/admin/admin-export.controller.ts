import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { USER_EXPORT_COLUMNS, buildUserExportRow } from './user-export.rows';

type AuthUser = { userId: string; role: string };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin/export')
export class AdminExportController {
  constructor(private readonly prisma: PrismaService) {}

  /** Extensionless path. A ".xlsx" URL 404s on some proxies and older API builds. */
  @Get(['users', 'users.xlsx'])
  async exportUsers(
    @Req() req: { user: AuthUser },
    @Res() res: Response,
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('search') search?: string,
    @Query('ids') ids?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (region) where.region = region;
    if (district) where.district = district;
    if (verificationStatus) where.verificationStatus = verificationStatus;

    const selectedIds = (ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (selectedIds.length) where.id = { in: selectedIds };

    const trimmedSearch = (search || '').trim();
    if (trimmedSearch) {
      where.OR = [
        { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
        { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
        { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
        { email: { contains: trimmedSearch, mode: 'insensitive' } },
        { phoneNumber: { contains: trimmedSearch, mode: 'insensitive' } },
        { profession: { contains: trimmedSearch, mode: 'insensitive' } },
        { district: { contains: trimmedSearch, mode: 'insensitive' } },
        { companyName: { contains: trimmedSearch, mode: 'insensitive' } },
      ];
    }

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="users-export-${stamp}.xlsx"`,
    );

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
    const sheet = workbook.addWorksheet('Foydalanuvchilar');
    sheet.columns = USER_EXPORT_COLUMNS.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
    }));
    sheet.getRow(1).font = { bold: true };

    const batchSize = 500;
    let cursor: string | undefined;
    let exported = 0;

    for (;;) {
      const batch = await this.prisma.user.findMany({
        where: where as never,
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!batch.length) break;

      const userIds = batch.map((user) => user.id);
      const verifications = await this.prisma.verificationRequest.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
      });
      const latestVerification = new Map<string, (typeof verifications)[number]>();
      for (const verification of verifications) {
        if (!latestVerification.has(verification.userId)) {
          latestVerification.set(verification.userId, verification);
        }
      }

      for (const user of batch) {
        const record = user as unknown as Record<string, unknown>;
        delete record.passwordHash;
        const verification = latestVerification.get(user.id) as unknown as Record<string, unknown> | undefined;
        sheet.addRow(buildUserExportRow(record, verification)).commit();
        exported += 1;
      }

      if (batch.length < batchSize) break;
      cursor = batch[batch.length - 1].id;
    }

    await sheet.commit();
    await workbook.commit();

    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'EXPORT_USERS_XLSX',
          userId: req.user.userId,
          details: {
            filters: {
              role,
              region,
              district,
              verificationStatus,
              search: trimmedSearch,
              selectedIds: selectedIds.length || undefined,
            },
            rowCount: exported,
          },
          type: 'info',
        },
      })
      .catch(() => undefined);
  }
}
