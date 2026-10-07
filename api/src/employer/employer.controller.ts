import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  approxDistanceLabel,
  boundingBox,
  haversineKm,
  isValidLatLng,
} from '../common/geo.util';
import { districtProximityKey } from '../common/district.util';
import { isValidDistrictId } from '../common/samarqand-districts';

type WorkerRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  photoUrl: string | null;
  phoneNumber: string | null;
  region: string;
  district: string | null;
  skills: string[];
  availability: string | null;
  experienceLevel: string | null;
  isVerified: boolean;
  rating: number;
  lookingForWork: boolean;
  latitude: number | null;
  longitude: number | null;
};

/** Public-only projection an employer may see — never personalInfo / indicators / exact coords. */
function toEmployerWorker(u: WorkerRow, distanceKm?: number) {
  return {
    uid: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: u.fullName,
    photoUrl: u.photoUrl,
    phoneNumber: u.phoneNumber,
    region: u.region,
    district: u.district,
    skills: u.skills,
    availability: u.availability,
    experienceLevel: u.experienceLevel,
    isVerified: u.isVerified,
    rating: u.rating,
    lookingForWork: u.lookingForWork,
    ...(distanceKm != null
      ? { distanceKm: Math.round(distanceKm * 10) / 10, distanceLabel: approxDistanceLabel(distanceKm) }
      : {}),
  };
}

const WORKER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  photoUrl: true,
  phoneNumber: true,
  region: true,
  district: true,
  skills: true,
  availability: true,
  experienceLevel: true,
  isVerified: true,
  rating: true,
  lookingForWork: true,
  latitude: true,
  longitude: true,
} as const;

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer', 'super_admin')
@Controller('employer')
export class EmployerController {
  constructor(private readonly prisma: PrismaService) {}

  /** Paginated, filterable public worker directory. */
  @Get('workers')
  async workers(
    @Query('search') search?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
    @Query('skill') skill?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('nearDistrict') nearDistrict?: string,
  ) {
    const take = clampInt(pageSize, 20, 1, 100);
    const currentPage = clampInt(page, 1, 1, 100000);
    const skip = (currentPage - 1) * take;

    const trimmedSearch = (search || '').trim();
    const where: Record<string, unknown> = { role: 'worker' };
    if (region) where.region = region;
    if (district) where.district = district;
    if (skill) where.skills = { has: skill };
    if (trimmedSearch) {
      where.OR = [
        { firstName: { contains: trimmedSearch, mode: 'insensitive' } },
        { lastName: { contains: trimmedSearch, mode: 'insensitive' } },
        { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
      ];
    }

    // When the buyurtmachi has a known district, recommend the nearest workers
    // first (same district → neighbouring districts → farther away).
    if (isValidDistrictId(nearDistrict)) {
      const rows = (await this.prisma.user.findMany({
        where: where as any,
        select: WORKER_SELECT,
        take: 2000,
      })) as WorkerRow[];
      const sorted = rows
        .map((r) => ({ r, key: districtProximityKey(nearDistrict, r.district) }))
        .sort(
          (a, b) =>
            a.key - b.key ||
            Number(b.r.isVerified) - Number(a.r.isVerified) ||
            b.r.rating - a.r.rating,
        );
      const total = sorted.length;
      const pageItems = sorted.slice(skip, skip + take);
      return {
        data: pageItems.map((x) => toEmployerWorker(x.r)),
        total,
        page: currentPage,
        pageSize: take,
        totalPages: Math.ceil(total / take),
      };
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where: where as any,
        select: WORKER_SELECT,
        orderBy: [{ isVerified: 'desc' }, { rating: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.user.count({ where: where as any }),
    ]);

    return {
      data: (rows as WorkerRow[]).map((r) => toEmployerWorker(r)),
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * Nearby workers by radius. Bounding-box prefilter in SQL, exact Haversine in JS.
   * Only workers who opted in (location_sharing_enabled) are considered.
   * Employers receive an approximate distance only — never exact coordinates.
   */
  @Get('workers/nearby')
  async nearby(
    @Query('lat') latRaw?: string,
    @Query('lng') lngRaw?: string,
    @Query('radius_km') radiusRaw?: string,
    @Query('skill') skill?: string,
    @Query('region') region?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!isValidLatLng(lat, lng)) {
      throw new BadRequestException('lat/lng noto\'g\'ri yoki yetishmayapti');
    }
    const radiusKm = clampInt(radiusRaw, 30, 1, 300);
    const take = clampInt(pageSize, 20, 1, 100);
    const currentPage = clampInt(page, 1, 1, 100000);

    const box = boundingBox(lat, lng, radiusKm);
    const where: Record<string, unknown> = {
      role: 'worker',
      locationSharingEnabled: true,
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    };
    if (region) where.region = region;
    if (skill) where.skills = { has: skill };

    const rows = (await this.prisma.user.findMany({
      where: where as any,
      select: WORKER_SELECT,
      take: 2000,
    })) as WorkerRow[];

    const withDistance = rows
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({ row: r, distanceKm: haversineKm(lat, lng, r.latitude!, r.longitude!) }))
      .filter((x) => x.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const total = withDistance.length;
    const start = (currentPage - 1) * take;
    const pageItems = withDistance.slice(start, start + take);

    return {
      data: pageItems.map((x) => toEmployerWorker(x.row, x.distanceKm)),
      total,
      page: currentPage,
      pageSize: take,
      totalPages: Math.ceil(total / take),
      radiusKm,
    };
  }
}
