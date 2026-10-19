import { BadRequestException, Controller, Get, Post, Patch, Put, Delete, Param, Body, Query, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
// Put: confidential personal-info updates (worker self / super_admin)
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { randomUUID } from 'crypto';
import { sanitizePersonalInfo } from '../personal-info/personal-info.util';
import { sanitizeCoreIndicators } from '../core-indicators/core-indicators.util';
import { normalizeNameInput } from '../common/name.util';
import { isValidLatLng, boundingBox, haversineKm, approxDistanceLabel } from '../common/geo.util';
import { clampStars, foldRating } from '../common/rating.util';
import { districtProximityKey } from '../common/district.util';
import { isValidDistrictId } from '../common/samarqand-districts';
import { DevSmsService } from '../auth/devsms.service';
import { SubscriptionGuard } from '../subscription/subscription.guard';
import { RequiresSubscription } from '../subscription/requires-subscription.decorator';
import { registrationPhone } from '../common/registration-phone.util';
import { isSafeAppPath } from '../common/safe-path.util';
import { moderateText } from '../common/moderation.util';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { hideReservedPhone, isReservedPhone } from '../owner/owner.constants';

type AuthUser = { userId: string; role: string };

function isStaff(role: string) {
  return role === 'admin' || role === 'super_admin';
}

function canAccessPersonalInfo(reqUser: AuthUser, targetUserId: string, targetRole?: string) {
  if (reqUser.role === 'super_admin') return true;
  if (reqUser.userId === targetUserId && (!targetRole || targetRole === 'worker')) return true;
  return false;
}

/** Strip identity / private verification docs and confidential personalInfo from public payloads */
function toPublicUser(
  user: Record<string, unknown>,
  opts?: {
    includePrivateDocs?: boolean;
    includePersonalInfo?: boolean;
    includeCoreIndicators?: boolean;
  },
) {
  const {
    passwordHash: _p,
    email: _email,
    phoneNumber,
    companyDocuments,
    personalInfo,
    coreIndicators,
    // Precise worker location never leaves the server in a public payload.
    latitude: _lat,
    longitude: _lng,
    tin,
    registrationNumber,
    recruiterContacts,
    riskScore,
    trustScore,
    behaviorFlags,
    violationCount,
    lastViolation,
    blockReason,
    blockUntil,
    blockedAt,
    isBlocked,
    telegram,
    ...rest
  } = user;
  const out: Record<string, unknown> = { ...rest };
  // The number used at signup. Workers publish it so a client can call them.
  const signupPhone = registrationPhone({
    phoneNumber,
    email: user.email,
    personalInfo,
  });
  if (String(user.role) === 'worker' && signupPhone && !isReservedPhone(signupPhone)) {
    out.phoneNumber = signupPhone;
  }
  if (opts?.includePrivateDocs) {
    out.companyDocuments = companyDocuments;
    out.tin = tin;
    out.registrationNumber = registrationNumber;
    out.recruiterContacts = recruiterContacts;
    out.riskScore = riskScore;
    out.trustScore = trustScore;
    out.behaviorFlags = behaviorFlags;
    out.violationCount = violationCount;
    out.lastViolation = lastViolation;
    out.blockReason = blockReason;
    out.blockUntil = blockUntil;
    out.blockedAt = blockedAt;
    out.isBlocked = isBlocked;
    out.telegram = telegram;
    if (signupPhone && !isReservedPhone(signupPhone)) out.phoneNumber = signupPhone;
  }
  if (opts?.includePersonalInfo) {
    out.personalInfo = personalInfo ?? null;
  }
  // Core/risk indicators are Super Admin-only — never in worker/employer/public payloads.
  if (opts?.includeCoreIndicators) {
    out.coreIndicators = coreIndicators ?? null;
  }
  return out;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async list(
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
    @Req() req?: { user?: AuthUser | null },
  ) {
    const staff = isStaff(req?.user?.role || '');
    if (!staff && role && role !== 'worker' && role !== 'employer') return [];
    const rows = await this.prisma.user.findMany({
      where: {
        ...(staff
          ? role
            ? { role: role as any }
            : {}
          : { role: (role as any) || { in: ['worker', 'employer'] }, isBlocked: false }),
        ...(region ? { region } : {}),
        ...(district ? { district } : {}),
        ...(staff ? {} : { AND: [hideReservedPhone()] }),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) =>
      toPublicUser(u as unknown as Record<string, unknown>, {
        includePrivateDocs: staff,
        includeCoreIndicators: req?.user?.role === 'super_admin',
      }),
    );
  }

  /** Confidential personal info — worker self or super_admin only */
  @UseGuards(JwtAuthGuard)
  @Get(':id/personal-info')
  async getPersonalInfo(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker') {
      throw new BadRequestException('Shaxsiy ma\'lumotlar faqat ishchi uchun');
    }
    if (!canAccessPersonalInfo(req.user, id, user.role)) {
      throw new ForbiddenException('Shaxsiy ma\'lumotlarga ruxsat yo\'q');
    }
    return { personalInfo: user.personalInfo ?? null };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/personal-info')
  async putPersonalInfo(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker') {
      throw new BadRequestException('Shaxsiy ma\'lumotlar faqat ishchi uchun');
    }
    if (!canAccessPersonalInfo(req.user, id, user.role)) {
      throw new ForbiddenException('Shaxsiy ma\'lumotlarni tahrirlashga ruxsat yo\'q');
    }

    const personalInfo = sanitizePersonalInfo(body.personalInfo ?? body, {
      userId: req.user.userId,
      role: req.user.role,
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { personalInfo: personalInfo as any },
    });

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE_PERSONAL_INFO',
        userId: req.user.userId,
        details: {
          targetUserId: id,
          updatedByRole: req.user.role,
          fields: Object.keys(personalInfo),
        },
        type: 'info',
      },
    }).catch(() => undefined);

    return { personalInfo: updated.personalInfo ?? null };
  }

  /** Core/risk indicators — Super Admin only (worker & employer never see them) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Get(':id/core-indicators')
  async getCoreIndicators(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker') {
      throw new BadRequestException('Индикаторлар фақат ишчи учун');
    }
    return { coreIndicators: user.coreIndicators ?? null };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Put(':id/core-indicators')
  async putCoreIndicators(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker') {
      throw new BadRequestException('Индикаторлар фақат ишчи учун');
    }

    const coreIndicators = sanitizeCoreIndicators(body.coreIndicators ?? body, {
      userId: req.user.userId,
      role: req.user.role,
    });

    const updated = await this.prisma.user.update({
      where: { id },
      data: { coreIndicators: coreIndicators as any },
    });

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE_CORE_INDICATORS',
        userId: req.user.userId,
        details: {
          targetUserId: id,
          fields: Object.keys(coreIndicators),
        },
        type: 'info',
      },
    }).catch(() => undefined);

    return { coreIndicators: updated.coreIndicators ?? null };
  }

  /** Worker opts in / updates their shared location (self or super_admin). */
  @UseGuards(JwtAuthGuard)
  @Put(':id/location')
  async updateLocation(
    @Param('id') id: string,
    @Body() body: { latitude?: number; longitude?: number; enabled?: boolean },
    @Req() req: { user: AuthUser },
  ) {
    if (req.user.userId !== id && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Lokatsiyani faqat egasi yoki Super Admin yangilaydi');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker' && user.role !== 'employer') {
      throw new BadRequestException('Lokatsiya faqat ishchi yoki buyurtmachi uchun');
    }
    const enabled = body.enabled !== false;
    if (enabled) {
      if (!isValidLatLng(body.latitude, body.longitude)) {
        throw new BadRequestException('Koordinatalar noto\'g\'ri');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: enabled
        ? {
            latitude: body.latitude,
            longitude: body.longitude,
            locationUpdatedAt: new Date(),
            locationSharingEnabled: true,
          }
        : { locationSharingEnabled: false },
    });
    return {
      locationSharingEnabled: updated.locationSharingEnabled,
      locationUpdatedAt: updated.locationUpdatedAt,
    };
  }

  /** Worker turns off sharing and wipes stored coordinates (self or super_admin). */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/location')
  async clearLocation(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    if (req.user.userId !== id && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Lokatsiyani faqat egasi yoki Super Admin o\'chiradi');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    await this.prisma.user.update({
      where: { id },
      data: {
        latitude: null,
        longitude: null,
        locationUpdatedAt: null,
        locationSharingEnabled: false,
      },
    });
    return { locationSharingEnabled: false };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string, @Req() req?: { user?: AuthUser | null }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const staff = isStaff(req?.user?.role || '');
    const isSelf = req?.user?.userId === id;
    if (user.isBlocked && !staff && !isSelf) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (!staff && !isSelf && isReservedPhone(String(user.phoneNumber || ''))) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    if (!staff && !isSelf && user.role !== 'worker' && user.role !== 'employer') {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    return toPublicUser(user as unknown as Record<string, unknown>, {
      includePrivateDocs: staff || isSelf,
      includePersonalInfo: isSelf && canAccessPersonalInfo(req!.user!, id, user.role),
      includeCoreIndicators: req?.user?.role === 'super_admin',
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: { user: { userId: string; role: string } }) {
    if (req.user.userId !== id && !['admin', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException();
    }

    const allowed = [
      'fullName', 'firstName', 'lastName', 'region', 'district', 'neighborhood',
      'bio', 'skills', 'profession', 'educationLevel', 'photoUrl', 'coverUrl', 'telegram', 'languages',
      'availability', 'lookingForWork', 'professionalSummary', 'preferredContact',
      'experienceLevel', 'education', 'experience', 'certificates', 'portfolio',
      'resumeTemplate', 'companyName', 'businessType', 'industry',
      'registrationNumber', 'tin', 'website', 'foundedYear', 'employeeCount',
      'officeAddress', 'companyGallery', 'companyDocuments', 'recruiterContacts',
    ] as const;

    // Moderators/admins may block users, but only Super Admin can change verification flags
    const adminOnly = [
      'isBlocked', 'blockUntil', 'blockReason', 'blockedAt', 'trustScore', 'riskScore',
      'isPremium', 'email', 'phoneNumber',
    ] as const;
    const superOnly = ['isVerified', 'verificationStatus', 'role'] as const;

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (isStaff(req.user.role)) {
      for (const key of adminOnly) {
        if (key in body) data[key] = body[key];
      }
    }
    if (req.user.role === 'super_admin') {
      for (const key of superOnly) {
        if (key in body) data[key] = body[key];
      }
    }

    // Keep firstName/lastName and fullName consistent regardless of which was sent.
    if ('firstName' in data || 'lastName' in data || 'fullName' in data) {
      const existing = await this.prisma.user.findUnique({
        where: { id },
        select: { firstName: true, lastName: true, fullName: true },
      });
      const name = normalizeNameInput({
        firstName: 'firstName' in data ? (data.firstName as string) : existing?.firstName,
        lastName: 'lastName' in data ? (data.lastName as string) : existing?.lastName,
        fullName:
          'firstName' in data || 'lastName' in data
            ? undefined
            : ('fullName' in data ? (data.fullName as string) : existing?.fullName),
      });
      data.firstName = name.firstName || null;
      data.lastName = name.lastName || null;
      if (name.fullName) data.fullName = name.fullName;
    }

    // personalInfo / coreIndicators must go through dedicated endpoints (stricter validation + RBAC)
    // Never accept them via generic PATCH

    const updated = await this.prisma.user.update({ where: { id }, data: data as any });
    const includePrivate =
      req.user.userId === id || req.user.role === 'super_admin';
    const includePersonal =
      canAccessPersonalInfo(req.user, id, updated.role);
    return toPublicUser(updated as unknown as Record<string, unknown>, {
      includePrivateDocs: includePrivate,
      includePersonalInfo: includePersonal,
      includeCoreIndicators: req.user.role === 'super_admin',
    });
  }
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async list(@Query() query: Record<string, string>, @Req() req?: { user?: AuthUser | null }) {
    const where: Record<string, unknown> = {};
    if (query.employerId) where.employerId = query.employerId;
    if (query.region) where.region = query.region;
    const staff = isStaff(req?.user?.role || '');
    const ownsQuery = Boolean(query.employerId && query.employerId === req?.user?.userId);
    if (staff || ownsQuery) {
      if (query.status) where.status = query.status;
    } else if (query.status === 'active' || query.status === 'open') {
      where.status = query.status;
    } else {
      where.status = { in: ['active', 'open'] };
    }

    // When a worker's district is known, recommend the nearest jobs first. A
    // job's location is taken from its employer's fixed registration district.
    if (isValidDistrictId(query.nearDistrict)) {
      const rows = await this.prisma.job.findMany({
        where: where as any,
        include: { employer: { select: { district: true } } },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      });
      return (rows as any[])
        .map((j) => ({
          job: j,
          key: districtProximityKey(query.nearDistrict, j.employer?.district ?? j.district),
        }))
        .sort((a, b) => a.key - b.key)
        .map(({ job }) => {
          const { employer: _employer, ...jobFields } = job;
          return jobFields;
        });
    }

    return this.prisma.job.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  /**
   * Open jobs near a worker's current location. The job's location is taken from
   * its employer's opted-in shared coordinates (location_sharing_enabled). We do a
   * bounding-box prefilter in SQL and the exact Haversine distance in JS. Workers
   * receive only an approximate distance — never the employer's exact coordinates.
   */
  @UseGuards(JwtAuthGuard)
  @Get('nearby')
  async nearby(
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
    @Query('radius_km') radiusRaw?: string,
    @Query('category') category?: string,
    @Query('region') region?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!isValidLatLng(lat, lng)) {
      throw new BadRequestException('lat/lng noto\'g\'ri yoki yetishmayapti');
    }
    const radiusKm = Math.min(300, Math.max(1, Math.floor(Number(radiusRaw) || 30)));
    const take = Math.min(100, Math.max(1, Math.floor(Number(pageSizeRaw) || 20)));
    const currentPage = Math.max(1, Math.floor(Number(pageRaw) || 1));

    const box = boundingBox(lat, lng, radiusKm);
    const where: Record<string, unknown> = {
      status: { in: ['active', 'open'] },
      employer: {
        is: {
          locationSharingEnabled: true,
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
        },
      },
    };
    if (category) where.category = category;
    if (region) where.region = region;

    const rows = await this.prisma.job.findMany({
      where: where as any,
      include: { employer: { select: { latitude: true, longitude: true } } },
      take: 2000,
    });

    const withDistance = (rows as any[])
      .filter((j) => j.employer?.latitude != null && j.employer?.longitude != null)
      .map((j) => ({
        job: j,
        distanceKm: haversineKm(lat, lng, j.employer.latitude, j.employer.longitude),
      }))
      .filter((x) => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const total = withDistance.length;
    const start = (currentPage - 1) * take;
    const pageItems = withDistance.slice(start, start + take);

    const data = pageItems.map(({ job, distanceKm }) => {
      const { employer: _employer, ...jobFields } = job;
      return {
        ...jobFields,
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceLabel: approxDistanceLabel(distanceKm),
      };
    });

    return {
      data,
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take),
      radiusKm,
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.job.findUniqueOrThrow({ where: { id } });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const id = (body.id as string) || randomUUID();
    // Employers can only create jobs for themselves
    const employerId =
      isStaff(req.user.role) && body.employerId
        ? String(body.employerId)
        : req.user.userId;

    const employer = await this.prisma.user.findUnique({ where: { id: employerId } });
    if (!employer) throw new NotFoundException('Buyurtmachi topilmadi');

    if (!isStaff(req.user.role)) {
      throw new ForbiddenException(
        'Buyurtmachilar eʼlon joylamaydi. Ishchilar roʻyxatidan tanlang va telefon orqali bogʻlaning.',
      );
    }
    const scheduledAt = parseOptionalDate(body.scheduledAt);
    if (!isStaff(req.user.role) && !scheduledAt) {
      throw new BadRequestException('Ish sanasi va vaqti majburiy');
    }
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('Ish sanasi kelajakdagi vaqt bo\'lishi kerak');
    }

    return this.prisma.job.create({
      data: {
        id,
        title: String(body.title || '').trim().slice(0, 200),
        description: body.description as string,
        employerId,
        employerName: body.employerName as string,
        category: body.category as string,
        // Public jobs inherit the employer's fixed registration district.
        // This prevents spoofed job addresses and powers district proximity.
        region: isStaff(req.user.role)
          ? (body.region as string) || employer.region
          : employer.region,
        district: isStaff(req.user.role)
          ? (body.district as string) || employer.district
          : employer.district,
        neighborhood: isStaff(req.user.role) ? (body.neighborhood as string) : null,
        salary: body.salary as number,
        price: body.price as number,
        salaryType: body.salaryType as string,
        workType: body.workType as string,
        scheduledAt,
        status: (body.status as any) || 'active',
        isPromoted: isStaff(req.user.role) ? Boolean(body.isPromoted) : false,
        requirements: isStaff(req.user.role) ? (body.requirements as string[]) || [] : [],
        images: (body.images as string[]) || [],
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('E\'lon topilmadi');
    if (job.employerId !== req.user.userId && !isStaff(req.user.role)) {
      throw new ForbiddenException();
    }
    const allowed = [
      'title', 'description', 'category', 'region', 'district', 'neighborhood',
      'salary', 'price', 'salaryType', 'workType', 'status', 'requirements', 'images',
      'employerName',
    ] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (isStaff(req.user.role) && 'isPromoted' in body) {
      data.isPromoted = Boolean(body.isPromoted);
    }
    if ('scheduledAt' in body) {
      data.scheduledAt = parseOptionalDate(body.scheduledAt);
    }
    return this.prisma.job.update({ where: { id }, data: data as any });
  }
}

@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devSms: DevSmsService,
  ) {}

  /** A worker is "busy" while they still have an accepted (not completed) job. */
  private async findActiveAssignment(workerId: string, exceptId?: string) {
    return this.prisma.application.findFirst({
      where: {
        workerId,
        status: 'accepted',
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query() query: Record<string, string>, @Req() req: { user: AuthUser }) {
    const where: Record<string, unknown> = {};
    if (query.jobId) where.jobId = query.jobId;
    if (query.status) where.status = query.status;

    if (isStaff(req.user.role)) {
      if (query.workerId) where.workerId = query.workerId;
      if (query.employerId) where.employerId = query.employerId;
    } else if (req.user.role === 'employer') {
      where.employerId = req.user.userId;
      if (query.workerId) where.workerId = query.workerId;
    } else {
      // Workers may only see their own applications
      where.workerId = req.user.userId;
    }

    return this.prisma.application.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    const app = await this.prisma.application.findUniqueOrThrow({ where: { id } });
    const allowed =
      isStaff(req.user.role) ||
      app.workerId === req.user.userId ||
      app.employerId === req.user.userId;
    if (!allowed) throw new ForbiddenException();
    return app;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: { userId: string; role: string } }) {
    const jobId = String(body.jobId || '');
    if (!jobId) throw new BadRequestException('jobId majburiy');

    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Ish e\'loni topilmadi');

    const workerId = req.user.userId;
    if (req.user.role !== 'worker' && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Faqat ishchi ariza yubora oladi');
    }

    const existing = await this.prisma.application.findFirst({
      where: { jobId, workerId },
    });
    if (existing) {
      throw new BadRequestException('Siz allaqachon bu ishga ariza yuborgansiz');
    }

    // A worker who is already busy with an accepted job cannot take another one.
    const busyWith = await this.findActiveAssignment(workerId);
    if (busyWith) {
      throw new BadRequestException(
        'Siz hozir boshqa ish bilan bandsiz. Avval joriy ishni yakunlang.',
      );
    }

    const worker = await this.prisma.user.findUnique({
      where: { id: workerId },
      select: { fullName: true, email: true },
    });

    const coverLetter = String(body.coverLetter || '');
    const message = String(body.message || coverLetter || '');
    const id = (body.id as string) || randomUUID();

    const created = await this.prisma.application.create({
      data: {
        id,
        jobId,
        workerId,
        employerId: job.employerId,
        workerName: (body.workerName as string) || worker?.fullName || null,
        jobTitle: (body.jobTitle as string) || job.title,
        message,
        coverLetter: coverLetter || null,
        status: 'pending',
      },
    });

    const workerName = created.workerName || 'Nomzod';
    const jobTitle = created.jobTitle || job.title;

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: job.employerId,
        title: 'Yangi ariza',
        message: `${workerName} sizning "${jobTitle}" e'loningizga ariza yubordi`,
        type: 'application',
        link: `/employer/jobs/${jobId}`,
        read: false,
      },
    });

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: workerId,
        title: 'Ariza yuborildi',
        message: `"${jobTitle}" ishiga arizangiz muvaffaqiyatli yuborildi`,
        type: 'application',
        link: '/jobs',
        read: false,
      },
    });

    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { id: true },
    });
    for (const admin of superAdmins) {
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: admin.id,
          title: 'Yangi ish arizasi',
          message: `${workerName} — "${jobTitle}" e'loniga ariza yubordi`,
          type: 'application',
          link: '/super-admin/applications',
          read: false,
        },
      });
    }

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'APPLY_JOB',
        userId: workerId,
        userEmail: worker?.email || undefined,
        details: { jobId, applicationId: created.id, employerId: job.employerId },
        type: 'info',
      },
    });

    return created;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const existing = await this.prisma.application.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ariza topilmadi');

    const isEmployer = existing.employerId === req.user.userId;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isEmployer && !isAdmin) throw new ForbiddenException();

    const status = body.status as string | undefined;

    // Completion has its own endpoint (worker-driven) — don't allow it via this PATCH.
    if (status === 'completed') {
      throw new BadRequestException(
        'Ishni yakunlash uchun /applications/:id/complete dan foydalaning',
      );
    }

    // Accepting hires the worker: make sure they aren't already busy elsewhere.
    if (status === 'accepted' && existing.status !== 'accepted') {
      if (existing.status !== 'pending') {
        throw new BadRequestException('Faqat kutilayotgan nomzodni qabul qilish mumkin');
      }
      const busyWith = await this.findActiveAssignment(existing.workerId, existing.id);
      if (busyWith) {
        throw new BadRequestException(
          'Bu ishchi hozir boshqa ish bilan band. Avval joriy ishni yakunlashi kerak.',
        );
      }
      const hiredForJob = await this.prisma.application.findFirst({
        where: { jobId: existing.jobId, status: 'accepted', NOT: { id: existing.id } },
      });
      if (hiredForJob) {
        throw new BadRequestException('Bu ish uchun boshqa ishchi allaqachon qabul qilingan');
      }
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        ...(status === 'accepted' ? { acceptedAt: new Date() } : {}),
        ...(body.message !== undefined ? { message: body.message as string } : {}),
        ...(body.coverLetter !== undefined ? { coverLetter: body.coverLetter as string } : {}),
      },
    });

    // Mark the worker busy on accept so they stop appearing as available.
    if (status === 'accepted' && existing.status !== 'accepted') {
      await this.prisma.user.update({
        where: { id: existing.workerId },
        data: { availability: 'busy', lookingForWork: false },
      }).catch(() => undefined);
      await this.prisma.job.update({
        where: { id: existing.jobId },
        data: { status: 'active' },
      }).catch(() => undefined);
      await this.prisma.application.updateMany({
        where: { jobId: existing.jobId, status: 'pending', NOT: { id: existing.id } },
        data: { status: 'rejected' },
      }).catch(() => undefined);

      const [job, worker, employer] = await Promise.all([
        this.prisma.job.findUnique({ where: { id: existing.jobId } }),
        this.prisma.user.findUnique({
          where: { id: existing.workerId },
          select: { fullName: true, phoneNumber: true },
        }),
        this.prisma.user.findUnique({
          where: { id: existing.employerId },
          select: { fullName: true, phoneNumber: true },
        }),
      ]);
      const jobTitle = existing.jobTitle || job?.title || 'ish';
      const workerName = existing.workerName || worker?.fullName || 'Ishchi';
      const schedule = formatJobSchedule(job?.scheduledAt);

      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: existing.workerId,
          title: 'Ishga qabul qilindingiz',
          message: `Siz "${jobTitle}" ishiga qabul qilindingiz. ${schedule} ishga borishingiz kerak.`,
          type: 'application',
          link: '/my-work',
          read: false,
        },
      });

      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: existing.employerId,
          title: 'Ishchi qabul qilindi',
          message: `${workerName} "${jobTitle}" ishini qabul qildi. ${schedule} ishchi kelishini kuting.`,
          type: 'application',
          link: `/employer/jobs/${existing.jobId}`,
          read: false,
        },
      }).catch(() => undefined);

      if (worker?.phoneNumber) {
        void this.devSms.sendNotificationSms(
          worker.phoneNumber,
          `Mehrli qollar: Siz "${jobTitle}" ishiga qabul qilindingiz. ${schedule} ishga borishingiz kerak. Tafsilotlar ilovada.`,
        );
      }
      if (employer?.phoneNumber) {
        void this.devSms.sendNotificationSms(
          employer.phoneNumber,
          `Mehrli qollar: ${workerName} "${jobTitle}" ishini qabul qildi. ${schedule} ishchi kelishini kuting.`,
        );
      }
    } else if (status === 'rejected') {
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: existing.workerId,
          title: 'Nomzodlik rad etildi',
          message: `Siz "${existing.jobTitle || 'ish'}" uchun tanlanmadingiz`,
          type: 'application',
          link: '/jobs',
          read: false,
        },
      });
    }

    return updated;
  }

  /**
   * Worker marks their accepted job as finished. This frees the worker (available
   * again), bumps completedJobs, texts the employer that the job is done, and
   * prompts the employer in-app to rate the worker.
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/complete')
  async complete(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Ariza topilmadi');

    const isOwnerWorker = app.workerId === req.user.userId;
    if (!isOwnerWorker && !isStaff(req.user.role)) {
      throw new ForbiddenException('Ishni faqat uni bajargan ishchi yakunlaydi');
    }
    if (app.status === 'completed') {
      throw new BadRequestException('Bu ish allaqachon yakunlangan');
    }
    if (app.status !== 'accepted') {
      throw new BadRequestException('Faqat qabul qilingan ishni yakunlash mumkin');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Free the worker and credit the finished job.
    await this.prisma.user.update({
      where: { id: app.workerId },
      data: {
        availability: 'available',
        lookingForWork: true,
        completedJobs: { increment: 1 },
      },
    }).catch(() => undefined);
    await this.prisma.job.update({
      where: { id: app.jobId },
      data: { status: 'closed' },
    }).catch(() => undefined);

    const jobTitle = app.jobTitle || 'ish';
    const workerName = app.workerName || 'Ishchi';

    // In-app prompt for the employer to rate the worker.
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: app.employerId,
        title: 'Ish yakunlandi',
        message: `${workerName} "${jobTitle}" ishini yakunladi. Iltimos, ishchini baholang.`,
        type: 'application',
        link: `/rate/${app.id}`,
        read: false,
      },
    }).catch(() => undefined);

    // Confirmation for the worker.
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: app.workerId,
        title: 'Ish yakunlandi',
        message: `Siz "${jobTitle}" ishini yakunladingiz. Buyurtmachi sizni baholaydi.`,
        type: 'application',
        link: '/my-work',
        read: false,
      },
    }).catch(() => undefined);

    // Best-effort SMS to the employer (never blocks completion).
    const employer = await this.prisma.user.findUnique({
      where: { id: app.employerId },
      select: { phoneNumber: true },
    });
    if (employer?.phoneNumber) {
      void this.devSms
        .sendNotificationSms(
          employer.phoneNumber,
          `Mehrli qollar: "${jobTitle}" ishi yakunlandi. Ilova orqali ${workerName}ning xizmat sifatini 5 yulduzda baholang.`,
        )
        .catch(() => undefined);
    }

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'COMPLETE_JOB',
        userId: req.user.userId,
        details: { applicationId: app.id, workerId: app.workerId, employerId: app.employerId },
        type: 'info',
      },
    }).catch(() => undefined);

    return updated;
  }
}

function toContractDto<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    // Frontend aliases (legacy field names)
    workerSigned: Boolean(row.signedByWorker),
    employerSigned: Boolean(row.signedByEmployer),
  };
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Noto'g'ri sana: ${String(value)}`);
  }
  return d;
}

function formatJobSchedule(value: Date | null | undefined): string {
  if (!value) return 'Kelishilgan vaqtda';
  return new Intl.DateTimeFormat('uz-UZ', {
    timeZone: 'Asia/Tashkent',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(value);
}

function normalizeContractWrite(body: Record<string, unknown>, opts?: { partial?: boolean }) {
  const partial = Boolean(opts?.partial);
  const data: Record<string, unknown> = {};

  const maybeSet = (key: string, value: unknown) => {
    if (value !== undefined) data[key] = value;
  };

  if (!partial || body.jobId !== undefined) maybeSet('jobId', body.jobId ? String(body.jobId) : null);
  if (!partial || body.workerId !== undefined) maybeSet('workerId', body.workerId ? String(body.workerId) : undefined);
  if (!partial || body.employerId !== undefined) maybeSet('employerId', body.employerId ? String(body.employerId) : undefined);
  if (!partial || body.workerName !== undefined) maybeSet('workerName', body.workerName != null ? String(body.workerName) : null);
  if (!partial || body.employerName !== undefined) maybeSet('employerName', body.employerName != null ? String(body.employerName) : null);
  if (!partial || body.jobTitle !== undefined) maybeSet('jobTitle', body.jobTitle != null ? String(body.jobTitle) : null);
  if (!partial || body.salary !== undefined) maybeSet('salary', body.salary != null && body.salary !== '' ? Number(body.salary) : null);
  if (!partial || body.amount !== undefined) maybeSet('amount', body.amount != null && body.amount !== '' ? Number(body.amount) : null);
  if (!partial || body.startDate !== undefined) maybeSet('startDate', parseOptionalDate(body.startDate));
  if (!partial || body.endDate !== undefined) maybeSet('endDate', parseOptionalDate(body.endDate));
  if (!partial || body.status !== undefined) maybeSet('status', body.status || 'draft');
  if (!partial || body.terms !== undefined) maybeSet('terms', body.terms != null ? String(body.terms) : null);

  if (
    !partial ||
    body.signedByWorker !== undefined ||
    body.workerSigned !== undefined
  ) {
    maybeSet(
      'signedByWorker',
      Boolean(body.signedByWorker ?? body.workerSigned ?? false),
    );
  }
  if (
    !partial ||
    body.signedByEmployer !== undefined ||
    body.employerSigned !== undefined
  ) {
    maybeSet(
      'signedByEmployer',
      Boolean(body.signedByEmployer ?? body.employerSigned ?? false),
    );
  }
  if (!partial || body.adminApproved !== undefined) {
    maybeSet('adminApproved', Boolean(body.adminApproved ?? false));
  }

  return data;
}

@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly devSms: DevSmsService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query() query: Record<string, string>, @Req() req: { user: AuthUser }) {
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;

    if (isStaff(req.user.role)) {
      if (query.workerId) where.workerId = query.workerId;
      if (query.employerId) where.employerId = query.employerId;
    } else if (req.user.role === 'employer') {
      where.employerId = req.user.userId;
    } else {
      where.workerId = req.user.userId;
    }

    const rows = await this.prisma.contract.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toContractDto(row as unknown as Record<string, unknown>));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async get(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    const row = await this.prisma.contract.findUniqueOrThrow({ where: { id } });
    const allowed =
      isStaff(req.user.role) ||
      row.workerId === req.user.userId ||
      row.employerId === req.user.userId;
    if (!allowed) throw new ForbiddenException();
    return toContractDto(row as unknown as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard)
  @Post('from-application/:applicationId')
  async createFromApplication(
    @Param('applicationId') applicationId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new NotFoundException('Ariza topilmadi');

    const isEmployer = app.employerId === req.user.userId;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isEmployer && !isAdmin) throw new ForbiddenException('Faqat buyurtmachi shartnoma yarata oladi');

    return this.create(
      {
        jobId: app.jobId,
        workerId: app.workerId,
        employerId: app.employerId,
        workerName: app.workerName,
        jobTitle: app.jobTitle,
        amount: body.amount,
        terms: body.terms,
        startDate: body.startDate,
        endDate: body.endDate,
        status: 'draft',
        signedByWorker: false,
        signedByEmployer: false,
        adminApproved: false,
        applicationId,
      },
      req,
    );
  }

  /** Offer from the worker list. The worker must confirm before the job can be finished. */
  @UseGuards(JwtAuthGuard)
  @Post('to-worker/:workerId')
  async sendToWorker(
    @Param('workerId') workerId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    if (!workerId || workerId === req.user.userId) {
      throw new BadRequestException("O'zingizga shartnoma yuborib bo'lmaydi");
    }
    const [worker, sender] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: workerId } }),
      this.prisma.user.findUnique({ where: { id: req.user.userId } }),
    ]);
    if (!worker || worker.role !== 'worker') throw new NotFoundException('Ishchi topilmadi');
    if (!sender) throw new NotFoundException('Hisob topilmadi');

    const busy = await this.prisma.application.findFirst({
      where: { workerId, status: 'accepted' },
    });
    if (busy) {
      throw new BadRequestException("Bu ishchi hozir band. Avval joriy ishini yakunlashi kerak.");
    }
    const waiting = await this.prisma.contract.findFirst({
      where: {
        workerId,
        employerId: sender.id,
        signedByWorker: false,
        status: { in: ['draft', 'active'] },
      },
    });
    if (waiting) {
      throw new BadRequestException("Shu ishchiga shartnoma yuborilgan. Tasdiqlashini kuting.");
    }

    let amount: number | null = null;
    if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
      const n = Number(body.amount);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException("Narx noto'g'ri");
      amount = n;
    }
    const specialty = (worker.profession || worker.skills?.[0] || '').trim();
    const title = (specialty ? `${worker.fullName} — ${specialty}` : `${worker.fullName} xizmati`).slice(0, 200);

    const created = await this.prisma.$transaction(async (tx) => {
      const jobId = randomUUID();
      const applicationId = randomUUID();
      const contractId = randomUUID();
      await tx.job.create({
        data: {
          id: jobId,
          title,
          description: "Ishchilar ro'yxatidan yuborilgan shartnoma.",
          employerId: sender.id,
          employerName: sender.fullName,
          category: specialty || null,
          region: worker.region || sender.region || 'Samarqand',
          district: worker.district || sender.district,
          price: amount,
          salary: amount,
          workType: 'direct',
          status: 'draft',
        },
      });
      await tx.application.create({
        data: {
          id: applicationId,
          jobId,
          workerId: worker.id,
          employerId: sender.id,
          workerName: worker.fullName,
          jobTitle: title,
          message: 'Shartnoma orqali taklif',
          status: 'pending',
        },
      });
      return tx.contract.create({
        data: {
          id: contractId,
          jobId,
          workerId: worker.id,
          employerId: sender.id,
          workerName: worker.fullName,
          employerName: sender.fullName,
          jobTitle: title,
          amount,
          terms: "Ishchi shartnomani tasdiqlagach ish boshlanadi. Tugagach ishchi yakunlaydi.",
          status: 'draft',
          signedByWorker: false,
          signedByEmployer: true,
        },
      });
    });

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: worker.id,
        title: 'Yangi shartnoma',
        message: `${sender.fullName || 'Buyurtmachi'} sizga "${title}" bo'yicha shartnoma yubordi. Tasdiqlang.`,
        type: 'contract',
        link: '/worker/contracts',
        read: false,
      },
    }).catch(() => undefined);
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: sender.id,
        title: 'Shartnoma yuborildi',
        message: `${worker.fullName} tasdiqlashi kutilmoqda.`,
        type: 'contract',
        link: `/contracts/${created.id}`,
        read: false,
      },
    }).catch(() => undefined);
    if (worker.phoneNumber && !isReservedPhone(worker.phoneNumber)) {
      void this.devSms
        .sendNotificationSms(
          worker.phoneNumber,
          `Mehrli qollar: ${sender.fullName || 'Buyurtmachi'} sizga shartnoma yubordi. Ilovada tasdiqlang.`,
        )
        .catch(() => undefined);
    }
    return toContractDto(created as unknown as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { userId: string; role: string } },
  ) {
    const data = normalizeContractWrite(body);
    if (!data.workerId || !data.employerId) {
      throw new BadRequestException('workerId va employerId majburiy');
    }

    if (
      String(data.employerId) !== req.user.userId &&
      !isStaff(req.user.role)
    ) {
      throw new ForbiddenException('Faqat buyurtmachi shartnoma yarata oladi');
    }

    // Enrich names/title when missing
    const [worker, employer, job] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: String(data.workerId) } }),
      this.prisma.user.findUnique({ where: { id: String(data.employerId) } }),
      data.jobId
        ? this.prisma.job.findUnique({ where: { id: String(data.jobId) } })
        : Promise.resolve(null),
    ]);
    if (!worker) throw new BadRequestException('Ishchi topilmadi');
    if (!employer) throw new BadRequestException('Buyurtmachi topilmadi');

    // Avoid FK 500 when jobId is stale/missing — keep title/amount from body/app
    const safeJobId = job ? job.id : null;

    const id = (body.id as string) || randomUUID();
    let created;
    try {
      created = await this.prisma.contract.create({
        data: {
          id,
          jobId: safeJobId,
          workerId: String(data.workerId),
          employerId: String(data.employerId),
          workerName: (data.workerName as string) || worker.fullName || null,
          employerName: (data.employerName as string) || employer.fullName || null,
          jobTitle: (data.jobTitle as string) || job?.title || 'Shartnoma',
          amount:
            data.amount != null && !Number.isNaN(Number(data.amount))
              ? Number(data.amount)
              : job?.price != null
                ? Number(job.price)
                : null,
          startDate: (data.startDate as Date | null | undefined) ?? null,
          endDate: (data.endDate as Date | null | undefined) ?? null,
          terms: (data.terms as string) || null,
          status: 'draft',
          signedByWorker: false,
          signedByEmployer: false,
          adminApproved: false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Shartnoma yaratib bo‘lmadi';
      throw new BadRequestException(message);
    }

    const jobTitle = created.jobTitle || 'Shartnoma';

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: created.workerId,
        title: 'Yangi shartnoma',
        message: `"${jobTitle}" ishi uchun yangi shartnoma yaratildi`,
        type: 'contract',
        link: '/worker/contracts',
        read: false,
      },
    });

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: created.employerId,
        title: 'Shartnoma yuborildi',
        message: `"${jobTitle}" uchun shartnoma Super Admin tekshiruviga yuborildi`,
        type: 'contract',
        link: '/employer/contracts',
        read: false,
      },
    });

    const superAdmins = await this.prisma.user.findMany({
      where: { role: 'super_admin' },
      select: { id: true },
    });
    for (const admin of superAdmins) {
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: admin.id,
          title: 'Yangi shartnoma',
          message: `${created.employerName || 'Buyurtmachi'} — "${jobTitle}" shartnomasi tekshiruvga yuborildi`,
          type: 'contract',
          link: '/super-admin/contracts',
          read: false,
        },
      });
    }

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'CREATE_CONTRACT',
        userId: req.user.userId,
        userEmail: employer.email || undefined,
        details: {
          contractId: created.id,
          jobId: created.jobId,
          workerId: created.workerId,
          employerId: created.employerId,
          amount: created.amount,
          applicationId: body.applicationId || null,
        },
        type: 'info',
      },
    });

    return toContractDto(created as unknown as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const existing = await this.prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Shartnoma topilmadi');

    const isWorker = existing.workerId === req.user.userId;
    const isEmployer = existing.employerId === req.user.userId;
    const staff = isStaff(req.user.role);
    if (!isWorker && !isEmployer && !staff) throw new ForbiddenException();

    const data = normalizeContractWrite(body, { partial: true });
    delete (data as any).workerSigned;
    delete (data as any).employerSigned;

    const workerConfirms =
      isWorker &&
      !existing.signedByWorker &&
      (body.signedByWorker === true || body.workerSigned === true);
    const employerConfirms =
      isEmployer &&
      !existing.signedByEmployer &&
      (body.signedByEmployer === true || body.employerSigned === true);

    // Party-scoped signature / approval fields
    if (!staff) {
      delete (data as any).adminApproved;
      delete (data as any).workerId;
      delete (data as any).employerId;
      if (!isWorker) delete (data as any).signedByWorker;
      if (!isEmployer) delete (data as any).signedByEmployer;
    }

    const bothSigned =
      (workerConfirms || existing.signedByWorker) &&
      (employerConfirms || existing.signedByEmployer);
    if ((workerConfirms || employerConfirms) && bothSigned) {
      data.status = 'active';
      // Accept the offer before the signature is stored. A busy worker then
      // keeps the contract unsigned and can confirm again after the current job.
      if (existing.jobId) {
        await this.openAcceptedWork(existing.jobId, existing.workerId);
      }
    }

    const updated = await this.prisma.contract.update({
      where: { id },
      data: data as any,
    });
    return toContractDto(updated as unknown as Record<string, unknown>);
  }

  /** Worker confirmation turns the linked offer into an accepted job, same as hiring. */
  private async openAcceptedWork(jobId: string, workerId: string) {
    const app = await this.prisma.application.findFirst({
      where: { jobId, workerId, status: 'pending' },
    });
    if (!app) return;
    const busy = await this.prisma.application.findFirst({
      where: { workerId, status: 'accepted', NOT: { id: app.id } },
    });
    if (busy) {
      throw new BadRequestException("Bu ishchi hozir band. Avval joriy ishini yakunlashi kerak.");
    }
    await this.prisma.application.update({
      where: { id: app.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    await this.prisma.user.update({
      where: { id: workerId },
      data: { availability: 'busy', lookingForWork: false },
    }).catch(() => undefined);
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (job && job.workType !== 'direct') {
      await this.prisma.job.update({
        where: { id: jobId },
        data: { status: 'active' },
      }).catch(() => undefined);
    }
    const jobTitle = app.jobTitle || job?.title || 'ish';
    const schedule = formatJobSchedule(job?.scheduledAt);
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: workerId,
        title: 'Ishga qabul qilindingiz',
        message: `Siz "${jobTitle}" ishiga qabul qilindingiz. ${schedule} ishga borishingiz kerak.`,
        type: 'application',
        link: '/my-work',
        read: false,
      },
    }).catch(() => undefined);
    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: app.employerId,
        title: 'Ishchi shartnomani tasdiqladi',
        message: `${app.workerName || 'Ishchi'} "${jobTitle}" shartnomasini tasdiqladi.`,
        type: 'application',
        link: '/employer/applications',
        read: false,
      },
    }).catch(() => undefined);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query('userId') userId: string | undefined, @Req() req: { user: AuthUser }) {
    const target =
      userId && isStaff(req.user.role) ? userId : req.user.userId;
    return this.prisma.notification.findMany({
      where: { userId: target },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const userId = String(body.userId || '');
    if (!userId) throw new BadRequestException('userId majburiy');
    const types = ['application', 'contract', 'message', 'dispute', 'system'] as const;
    const requested = String(body.type || 'system');
    const type = types.includes(requested as (typeof types)[number])
      ? (requested as (typeof types)[number])
      : 'system';
    const staff = isStaff(req.user.role);
    if (!staff) {
      if (type === 'system') throw new ForbiddenException();
      if (userId !== req.user.userId) {
        const related = await this.callerMayNotify(req.user.userId, userId);
        if (!related) throw new ForbiddenException();
      }
    }
    const rawLink = body.link != null ? String(body.link) : '';
    const link = rawLink && isSafeAppPath(rawLink) ? rawLink : null;
    return this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId,
        title: String(body.title || '').slice(0, 200),
        message: String(body.message || '').slice(0, 2000),
        type,
        link,
        read: false,
      } as any,
    });
  }

  private async callerMayNotify(me: string, target: string) {
    const [contract, application, chat] = await Promise.all([
      this.prisma.contract.findFirst({
        where: {
          OR: [
            { workerId: me, employerId: target },
            { workerId: target, employerId: me },
          ],
        },
        select: { id: true },
      }),
      this.prisma.application.findFirst({
        where: {
          OR: [
            { workerId: me, employerId: target },
            { workerId: target, employerId: me },
          ],
        },
        select: { id: true },
      }),
      this.prisma.chatMessage.findFirst({
        where: {
          OR: [
            { senderId: me, receiverId: target },
            { senderId: target, receiverId: me },
          ],
        },
        select: { id: true },
      }),
    ]);
    return Boolean(contract || application || chat);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    if (row.userId !== req.user.userId && !isStaff(req.user.role)) {
      throw new ForbiddenException();
    }
    return this.prisma.notification.update({
      where: { id },
      data: { read: body.read !== undefined ? Boolean(body.read) : row.read },
    });
  }
}

@Controller('chat-messages')
export class ChatMessagesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Conversation inbox for the authenticated user (or queried userId for own inbox) */
  @UseGuards(JwtAuthGuard)
  @Get('inbox')
  async inbox(@Req() req: { user: { userId: string; role: string } }, @Query('userId') userId?: string) {
    const me = userId && ['admin', 'super_admin'].includes(req.user.role) ? userId : req.user.userId;
    const rows = await this.prisma.chatMessage.findMany({
      where: { OR: [{ senderId: me }, { receiverId: me }] },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });

    const peerMap = new Map<
      string,
      { peerId: string; lastMessage: string; lastAt: Date; unreadCount: number }
    >();
    for (const row of rows) {
      const peerId = row.senderId === me ? row.receiverId : row.senderId;
      const existing = peerMap.get(peerId);
      if (!existing) {
        peerMap.set(peerId, {
          peerId,
          lastMessage: row.content,
          lastAt: row.createdAt,
          unreadCount: row.receiverId === me && !row.read ? 1 : 0,
        });
      } else if (row.receiverId === me && !row.read) {
        existing.unreadCount += 1;
      }
    }

    const peers = await this.prisma.user.findMany({
      where: { id: { in: Array.from(peerMap.keys()) } },
      select: { id: true, fullName: true, role: true, photoUrl: true, companyName: true },
    });
    const peerInfo = new Map(peers.map((p) => [p.id, p]));

    return Array.from(peerMap.values())
      .map((t) => {
        const u = peerInfo.get(t.peerId);
        return {
          peerId: t.peerId,
          peerName: u?.companyName || u?.fullName || 'Foydalanuvchi',
          peerRole: u?.role,
          peerPhotoUrl: u?.photoUrl,
          lastMessage: t.lastMessage,
          lastAt: t.lastAt,
          unreadCount: t.unreadCount,
        };
      })
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @Query('userA') userA: string,
    @Query('userB') userB: string,
    @Req() req: { user: AuthUser },
  ) {
    if (!userA || !userB) throw new BadRequestException('userA va userB majburiy');
    const me = req.user.userId;
    if (!isStaff(req.user.role) && me !== userA && me !== userB) {
      throw new ForbiddenException();
    }
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userA, receiverId: userB },
          { senderId: userB, receiverId: userA },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    // Frontend historically used `text` — expose both for compatibility
    return rows.map((r) => ({ ...r, text: r.content, message: r.content }));
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: { userId: string } }) {
    const id = (body.id as string) || randomUUID();
    const content = String(body.content || body.message || body.text || '').trim();
    if (!content) throw new BadRequestException('Xabar bo\'sh');
    const moderation = moderateText(content);
    if (!moderation.allowed) {
      await this.prisma.violation.create({
        data: {
          id: randomUUID(),
          userId: req.user.userId,
          violationType: moderation.violationType || 'profanity',
          message: content.slice(0, 500),
          action: 'blocked',
        },
      }).catch(() => undefined);
      throw new BadRequestException(moderation.reason || 'Xabar rad etildi');
    }
    const senderId = req.user.userId;
    const receiverId = String(body.receiverId || '');
    if (!receiverId) throw new BadRequestException('receiverId majburiy');

    const created = await this.prisma.chatMessage.create({
      data: {
        id,
        senderId,
        receiverId,
        content,
        read: false,
        delivered: true,
        status: 'sent',
        jobId: body.jobId as string,
        contractId: body.contractId as string,
      },
    });

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { fullName: true, role: true },
    });
    const chatLink =
      (await this.prisma.user.findUnique({ where: { id: receiverId }, select: { role: true } }))?.role ===
      'super_admin'
        ? `/super-admin/messages?with=${senderId}`
        : `/chat?with=${senderId}`;

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: receiverId,
        title: 'Yangi xabar',
        message: `${sender?.fullName || 'Foydalanuvchi'}: ${content.slice(0, 80)}`,
        type: 'message',
        link: chatLink,
        read: false,
      },
    });

    await this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: 'SEND_MESSAGE',
        userId: senderId,
        details: { receiverId, preview: content.slice(0, 80) },
        type: 'info',
      },
    });

    return { ...created, text: created.content, message: created.content };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const msg = await this.prisma.chatMessage.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Xabar topilmadi');
    const staff = isStaff(req.user.role);
    if (!staff && msg.senderId !== req.user.userId && msg.receiverId !== req.user.userId) {
      throw new ForbiddenException();
    }
    const data: { read?: boolean; status?: string; delivered?: boolean } = {};
    if (body.read === true && (staff || msg.receiverId === req.user.userId)) data.read = true;
    if (body.status === 'sent' || body.status === 'delivered' || body.status === 'read') {
      data.status = body.status;
    }
    if (body.delivered === true && (staff || msg.receiverId === req.user.userId)) data.delivered = true;
    return this.prisma.chatMessage.update({ where: { id }, data });
  }
}

@Controller('disputes')
export class DisputesController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Req() req: { user: AuthUser }) {
    if (isStaff(req.user.role)) {
      return this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' } });
    }
    return this.prisma.dispute.findMany({
      where: {
        OR: [
          { openedById: req.user.userId },
          { contract: { workerId: req.user.userId } },
          { contract: { employerId: req.user.userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const contractId = String(body.contractId || '');
    const reason = String(body.reason || '').trim();
    if (!contractId || reason.length < 3) {
      throw new BadRequestException('Shartnoma va nizo sababi majburiy');
    }
    const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
    if (!contract) throw new NotFoundException('Shartnoma topilmadi');
    const party =
      isStaff(req.user.role) ||
      contract.workerId === req.user.userId ||
      contract.employerId === req.user.userId;
    if (!party) throw new ForbiddenException();
    const dispute = await this.prisma.dispute.create({
      data: {
        id: randomUUID(),
        contractId,
        openedById: req.user.userId,
        reason: reason.slice(0, 2000),
        status: 'pending',
      },
    });
    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'disputed' },
    });
    return dispute;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    if (!isStaff(req.user.role)) throw new ForbiddenException();
    const data: { status?: 'pending' | 'resolved' | 'rejected'; resolution?: string } = {};
    if (body.status === 'pending' || body.status === 'resolved' || body.status === 'rejected') {
      data.status = body.status;
    }
    if (typeof body.resolution === 'string') data.resolution = body.resolution.slice(0, 2000);
    return this.prisma.dispute.update({ where: { id }, data });
  }
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('revieweeId') revieweeId?: string, @Query('workerId') workerId?: string) {
    const id = revieweeId || workerId;
    if (!id) return [];
    return this.prisma.review.findMany({
      where: { revieweeId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const rating = clampStars(body.rating);
    if (rating < 1) {
      throw new BadRequestException('Baho 1 dan 5 gacha yulduz bo\'lishi kerak');
    }
    const comment = body.comment != null ? String(body.comment).trim().slice(0, 1000) : null;
    const applicationId = body.applicationId ? String(body.applicationId) : null;

    let revieweeId = body.revieweeId ? String(body.revieweeId) : '';
    let application: Awaited<ReturnType<typeof this.prisma.application.findUnique>> = null;

    // When a review is tied to a finished job, only the hiring employer may rate,
    // the job must be completed, and each completed job can be rated only once.
    if (applicationId) {
      application = await this.prisma.application.findUnique({ where: { id: applicationId } });
      if (!application) throw new NotFoundException('Ariza topilmadi');
      if (application.employerId !== req.user.userId && !isStaff(req.user.role)) {
        throw new ForbiddenException('Ishchini faqat uni yollagan buyurtmachi baholaydi');
      }
      if (application.status !== 'completed') {
        throw new BadRequestException('Faqat yakunlangan ishni baholash mumkin');
      }
      if (application.reviewed) {
        throw new BadRequestException('Bu ish allaqachon baholangan');
      }
      revieweeId = application.workerId;
    }

    if (!revieweeId) throw new BadRequestException('revieweeId majburiy');
    if (revieweeId === req.user.userId) {
      throw new BadRequestException('O\'zingizni baholay olmaysiz');
    }

    const reviewee = await this.prisma.user.findUnique({ where: { id: revieweeId } });
    if (!reviewee) throw new NotFoundException('Foydalanuvchi topilmadi');

    const reviewer = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { fullName: true },
    });

    const id = (body.id as string) || randomUUID();
    const created = await this.prisma.review.create({
      data: {
        id,
        reviewerId: req.user.userId,
        revieweeId,
        reviewerName: reviewer?.fullName || null,
        rating,
        comment,
        contractId: body.contractId ? String(body.contractId) : null,
        applicationId,
      },
    });

    // Fold the new star rating into the worker's running average.
    const folded = foldRating(reviewee.rating, reviewee.reviewCount, rating);
    await this.prisma.user.update({
      where: { id: revieweeId },
      data: { rating: folded.rating, reviewCount: folded.reviewCount },
    });

    if (application) {
      await this.prisma.application.update({
        where: { id: application.id },
        data: { reviewed: true },
      });
    }

    await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: revieweeId,
        title: 'Yangi baho',
        message: `Buyurtmachi sizning ishingizni ${rating} yulduz bilan baholadi`,
        type: 'application',
        link: '/my-work',
        read: false,
      },
    }).catch(() => undefined);

    return created;
  }
}

@Controller('saved-jobs')
export class SavedJobsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(@Query('userId') userId: string | undefined, @Req() req: { user: AuthUser }) {
    const target = userId && isStaff(req.user.role) ? userId : req.user.userId;
    return this.prisma.savedJob.findMany({
      where: { userId: target },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: { userId?: string; jobId: string }, @Req() req: { user: AuthUser }) {
    const id = randomUUID();
    return this.prisma.savedJob.create({
      data: { id, userId: req.user.userId, jobId: body.jobId },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete')
  async remove(@Body() body: { userId?: string; jobId?: string }, @Req() req: { user: AuthUser }) {
    const jobId = String(body.jobId || '');
    if (!jobId) throw new BadRequestException('jobId majburiy');
    const userId = isStaff(req.user.role) && body.userId ? body.userId : req.user.userId;
    await this.prisma.savedJob.deleteMany({ where: { userId, jobId } });
    return { success: true };
  }
}

@Controller('service-posts')
export class ServicePostsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (query.workerId) where.workerId = query.workerId;
    if (query.status) where.status = query.status;
    return this.prisma.servicePost.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    if (!isStaff(req.user.role) && req.user.role !== 'worker') {
      throw new ForbiddenException('Xizmat eʼlonini faqat ishchi yaratadi');
    }
    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('Sarlavha majburiy');
    const workerId =
      isStaff(req.user.role) && typeof body.workerId === 'string' ? body.workerId : req.user.userId;
    const fields = this.servicePostFields(body, title);
    return this.prisma.servicePost.create({
      data: {
        id: randomUUID(),
        workerId,
        title: fields.title || title.slice(0, 200),
        description: fields.description,
        category: fields.category,
        workerName: fields.workerName,
        region: fields.region,
        district: fields.district,
        priceType: fields.priceType,
        expectedPrice: fields.expectedPrice,
        price: fields.price,
        images: fields.images,
        status: fields.status,
        isActive: fields.isActive,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    const post = await this.prisma.servicePost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Eʼlon topilmadi');
    if (!isStaff(req.user.role) && post.workerId !== req.user.userId) {
      throw new ForbiddenException();
    }
    return this.prisma.servicePost.update({
      where: { id },
      data: this.servicePostFields(body),
    });
  }

  private servicePostFields(body: Record<string, unknown>, title?: string) {
    const statuses = ['active', 'inactive', 'pending'] as const;
    const status = statuses.includes(body.status as (typeof statuses)[number])
      ? (body.status as (typeof statuses)[number])
      : undefined;
    const images = Array.isArray(body.images)
      ? body.images.filter((item) => typeof item === 'string').slice(0, 8).map((item) => item.slice(0, 500))
      : undefined;
    const price = Number(body.expectedPrice ?? body.price);
    return {
      ...(title ? { title: title.slice(0, 200) } : typeof body.title === 'string' ? { title: body.title.trim().slice(0, 200) } : {}),
      ...(typeof body.description === 'string' ? { description: body.description.slice(0, 4000) } : {}),
      ...(typeof body.category === 'string' ? { category: body.category.slice(0, 80) } : {}),
      ...(typeof body.workerName === 'string' ? { workerName: body.workerName.slice(0, 120) } : {}),
      ...(typeof body.region === 'string' ? { region: body.region.slice(0, 80) } : {}),
      ...(typeof body.district === 'string' ? { district: body.district.slice(0, 80) } : {}),
      ...(typeof body.priceType === 'string' ? { priceType: body.priceType.slice(0, 40) } : {}),
      ...(Number.isFinite(price) ? { expectedPrice: price, price } : {}),
      ...(images ? { images } : {}),
      ...(status ? { status, isActive: status === 'active' } : {}),
    };
  }
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: { user: AuthUser }, @Query('userId') userId?: string) {
    const staff = isStaff(req.user.role);
    if (!staff && userId && userId !== req.user.userId) throw new ForbiddenException();
    return this.prisma.payment.findMany({
      where: staff && !userId ? undefined : { userId: staff ? userId : req.user.userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const staff = isStaff(req.user.role);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      throw new BadRequestException('To‘lov summasi noto‘g‘ri');
    }
    const statuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'] as const;
    const status = staff && statuses.includes(body.status as (typeof statuses)[number])
      ? (body.status as (typeof statuses)[number])
      : 'pending';
    return this.prisma.payment.create({
      data: {
        id: randomUUID(),
        userId: staff && typeof body.userId === 'string' ? body.userId : req.user.userId,
        amount,
        currency: typeof body.currency === 'string' ? body.currency.slice(0, 8) : 'UZS',
        type: String(body.type || 'other').slice(0, 40),
        provider: String(body.provider || 'manual').slice(0, 40),
        status,
        metadata:
          body.metadata && typeof body.metadata === 'object' ? (body.metadata as object) : undefined,
      },
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    if (!isStaff(req.user.role)) throw new ForbiddenException();
    const statuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'] as const;
    const data: { status?: (typeof statuses)[number]; transactionId?: string } = {};
    if (statuses.includes(body.status as (typeof statuses)[number])) {
      data.status = body.status as (typeof statuses)[number];
    }
    if (typeof body.transactionId === 'string') data.transactionId = body.transactionId.slice(0, 120);
    return this.prisma.payment.update({ where: { id }, data });
  }
}

@Controller('violations')
export class ViolationsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const userId = String(body.userId || '');
    const violationType = String(body.violationType || '').trim();
    if (!userId || !violationType) throw new BadRequestException('userId va violationType majburiy');
    return this.prisma.violation.create({
      data: {
        id: randomUUID(),
        userId,
        violationType: violationType.slice(0, 80),
        message: typeof body.message === 'string' ? body.message.slice(0, 500) : undefined,
        action: typeof body.action === 'string' ? body.action.slice(0, 80) : 'recorded',
      },
    });
  }
}

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Get()
  async list(@Query('userId') userId?: string) {
    return this.prisma.activityLog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    return this.prisma.activityLog.create({
      data: {
        id: randomUUID(),
        userId: req.user.userId,
        action: String(body.action || 'ACTION').slice(0, 120),
        details: body.details && typeof body.details === 'object' ? (body.details as object) : {},
      },
    });
  }
}

@Controller('system-logs')
export class SystemLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Get()
  async list() {
    return this.prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const staffTypes = ['info', 'warn', 'error'] as const;
    const type = isStaff(req.user.role) && staffTypes.includes(body.type as (typeof staffTypes)[number])
      ? (body.type as (typeof staffTypes)[number])
      : 'info';
    return this.prisma.systemLog.create({
      data: {
        id: randomUUID(),
        action: String(body.action || 'ACTION').slice(0, 120),
        userId: req.user.userId,
        details: body.details && typeof body.details === 'object' ? (body.details as object) : {},
        type,
      } as any,
    });
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin')
  @Get('global')
  async getGlobal() {
    return this.prisma.globalSettings.findUnique({ where: { id: 'global_config' } });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
  @Roles('super_admin')
  @RequiresSubscription()
  @Patch('global')
  async updateGlobal(@Body() body: Record<string, unknown>, @Req() req: { user: AuthUser }) {
    const keys = [
      'maxJobPostsPerWeek',
      'maxServicePostsPerWeek',
      'maxApplicationsPerDay',
      'enableNotifications',
      'enableModeration',
      'maintenanceMode',
    ] as const;
    const data: Record<string, unknown> = { updatedBy: req.user.userId };
    for (const key of keys) {
      if (key in body) data[key] = body[key];
    }
    return this.prisma.globalSettings.upsert({
      where: { id: 'global_config' },
      create: { id: 'global_config', ...data } as any,
      update: data as any,
    });
  }
}

@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('counts')
  async counts() {
    const [
      users,
      jobs,
      applications,
      contracts,
      workers,
      employers,
      activeJobs,
      pendingApplications,
      activeContracts,
      completedContracts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.count(),
      this.prisma.application.count(),
      this.prisma.contract.count(),
      this.prisma.user.count({ where: { role: 'worker' } }),
      this.prisma.user.count({ where: { role: 'employer' } }),
      this.prisma.job.count({ where: { status: { in: ['active', 'open'] } } }),
      this.prisma.application.count({ where: { status: 'pending' } }),
      this.prisma.contract.count({ where: { status: 'active' } }),
      this.prisma.contract.count({ where: { status: 'completed' } }),
    ]);
    return {
      users,
      jobs,
      applications,
      contracts,
      workers,
      employers,
      activeJobs,
      pendingApplications,
      activeContracts,
      completedContracts,
    };
  }
}
