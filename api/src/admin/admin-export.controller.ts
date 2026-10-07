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
import { profileCompletionPercent } from '../common/profile-completion.util';
import { riskIndex, safeCell } from '../common/xlsx-safe.util';

type AuthUser = { userId: string; role: string };

const COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'UID', key: 'uid', width: 26 },
  { header: 'Ism', key: 'firstName', width: 16 },
  { header: 'Familiya', key: 'lastName', width: 16 },
  { header: "To'liq ism", key: 'fullName', width: 24 },
  { header: 'Rol', key: 'role', width: 14 },
  { header: 'Profil %', key: 'completion', width: 10 },
  { header: 'Email', key: 'email', width: 24 },
  { header: 'Telefon', key: 'phoneNumber', width: 16 },
  { header: "Qo'shimcha telefon", key: 'additionalPhone', width: 16 },
  { header: 'Viloyat', key: 'region', width: 16 },
  { header: 'Tuman', key: 'district', width: 16 },
  { header: 'Mahalla', key: 'neighborhood', width: 16 },
  { header: 'Tasdiqlangan', key: 'isVerified', width: 12 },
  { header: 'Tekshiruv holati', key: 'verificationStatus', width: 16 },
  { header: 'Bloklangan', key: 'isBlocked', width: 10 },
  { header: 'Reyting', key: 'rating', width: 10 },
  { header: 'Risk ball', key: 'riskScore', width: 10 },
  { header: "Yaratilgan", key: 'createdAt', width: 20 },
  { header: 'Yangilangan', key: 'updatedAt', width: 20 },
  { header: 'Oxirgi faollik', key: 'lastActive', width: 20 },
  // Confidential personal info (Super Admin only — this export is super_admin gated)
  { header: "Tug'ilgan sana", key: 'pi_dateOfBirth', width: 14 },
  { header: 'Yosh', key: 'pi_age', width: 8 },
  { header: 'Jinsi', key: 'pi_gender', width: 10 },
  { header: 'Oilaviy holati', key: 'pi_maritalStatus', width: 14 },
  { header: 'Farzandlar', key: 'pi_childrenStatus', width: 12 },
  { header: 'Farzandlar soni', key: 'pi_childrenCount', width: 12 },
  { header: 'Kasbi', key: 'pi_profession', width: 16 },
  { header: 'Mutaxassislik', key: 'pi_specialty', width: 16 },
  { header: "Ta'lim darajasi", key: 'pi_educationLevel', width: 16 },
  { header: 'Fuqarolik', key: 'pi_citizenship', width: 14 },
  { header: 'Joriy manzil', key: 'pi_currentAddress', width: 24 },
  { header: 'Doimiy manzil', key: 'pi_permanentAddress', width: 24 },
  // Core / risk indicators (Super Admin only)
  { header: 'Oila daromadi', key: 'ci_familyIncome', width: 16 },
  { header: 'Ona ijtimoiy holati', key: 'ci_motherSocialStatus', width: 18 },
  { header: "Ta'lim natijalari", key: 'ci_educationResults', width: 16 },
  { header: 'Davomat', key: 'ci_attendance', width: 12 },
  { header: 'Salomatlik', key: 'ci_healthStatus', width: 14 },
  { header: 'Psixologik holat', key: 'ci_psychologicalState', width: 16 },
  { header: 'Nogironlik', key: 'ci_disabilityStatus', width: 14 },
  { header: 'Erta nikoh xavfi', key: 'ci_earlyMarriageRisk', width: 14 },
  { header: 'Zo\'ravonlik xavfi', key: 'ci_violenceRisk', width: 14 },
  { header: 'Raqamli savodxonlik', key: 'ci_digitalLiteracy', width: 16 },
  { header: 'Xavf bahosi', key: 'ci_riskAssessment', width: 24 },
  { header: 'Risk indeksi', key: 'ci_riskIndex', width: 12 },
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin/export')
export class AdminExportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users.xlsx')
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

    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
    const sheet = workbook.addWorksheet('Foydalanuvchilar');
    sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
    sheet.getRow(1).font = { bold: true };

    const batchSize = 500;
    let cursor: string | undefined;
    let exported = 0;

    // Keyset pagination keeps memory flat for very large exports.
    for (;;) {
      const batch = await this.prisma.user.findMany({
        where: where as any,
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (!batch.length) break;

      for (const u of batch) {
        const user = u as unknown as Record<string, any>;
        const pi = (user.personalInfo || {}) as Record<string, unknown>;
        const ci = (user.coreIndicators || null) as Record<string, unknown> | null;

        sheet
          .addRow({
            uid: safeCell(user.id),
            firstName: safeCell(user.firstName),
            lastName: safeCell(user.lastName),
            fullName: safeCell(user.fullName),
            role: safeCell(user.role),
            completion: profileCompletionPercent(user),
            email: safeCell(user.email),
            phoneNumber: safeCell(user.phoneNumber),
            additionalPhone: safeCell(pi.additionalPhone),
            region: safeCell(user.region),
            district: safeCell(user.district),
            neighborhood: safeCell(user.neighborhood),
            isVerified: user.isVerified ? 'Ha' : "Yo'q",
            verificationStatus: safeCell(user.verificationStatus),
            isBlocked: user.isBlocked ? 'Ha' : "Yo'q",
            rating: safeCell(user.rating),
            riskScore: safeCell(user.riskScore),
            createdAt: safeCell(user.createdAt),
            updatedAt: safeCell(user.updatedAt),
            lastActive: safeCell(user.lastActive),
            pi_dateOfBirth: safeCell(pi.dateOfBirth),
            pi_age: safeCell(pi.age),
            pi_gender: safeCell(pi.gender),
            pi_maritalStatus: safeCell(pi.maritalStatus),
            pi_childrenStatus: safeCell(pi.childrenStatus),
            pi_childrenCount: safeCell(pi.childrenCount),
            pi_profession: safeCell(pi.profession),
            pi_specialty: safeCell(pi.specialty),
            pi_educationLevel: safeCell(pi.educationLevel),
            pi_citizenship: safeCell(pi.citizenship),
            pi_currentAddress: safeCell(pi.currentAddress),
            pi_permanentAddress: safeCell(pi.permanentAddress),
            ci_familyIncome: safeCell(ci?.familyIncome),
            ci_motherSocialStatus: safeCell(ci?.motherSocialStatus),
            ci_educationResults: safeCell(ci?.educationResults),
            ci_attendance: safeCell(ci?.attendance),
            ci_healthStatus: safeCell(ci?.healthStatus),
            ci_psychologicalState: safeCell(ci?.psychologicalState),
            ci_disabilityStatus: safeCell(ci?.disabilityStatus),
            ci_earlyMarriageRisk: safeCell(ci?.earlyMarriageRisk),
            ci_violenceRisk: safeCell(ci?.violenceRisk),
            ci_digitalLiteracy: safeCell(ci?.digitalLiteracy),
            ci_riskAssessment: safeCell(ci?.riskAssessment),
            ci_riskIndex: riskIndex(ci),
          })
          .commit();
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
            filters: { role, region, district, verificationStatus, search: trimmedSearch, selectedIds: selectedIds.length || undefined },
            rowCount: exported,
          },
          type: 'info',
        },
      })
      .catch(() => undefined);
  }
}
