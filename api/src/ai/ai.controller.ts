import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { boundingBox, haversineKm, isValidLatLng } from '../common/geo.util';
import { AiLanguage, AiService } from './ai.service';

type AuthUser = { userId: string; role: string };

function normLang(v: unknown): AiLanguage {
  return v === 'ru' || v === 'en' ? v : 'uz';
}

function clampStr(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  status() {
    return { live: this.ai.isLive(), provider: this.ai.getProvider() };
  }

  /** Employer: draft / improve a vacancy description. */
  @Roles('employer', 'super_admin')
  @Post('employer/vacancy')
  async vacancy(
    @Body()
    body: {
      title?: string;
      category?: string;
      description?: string;
      requirements?: string[];
      region?: string;
      salary?: number | string;
      language?: string;
    },
  ) {
    const title = clampStr(body.title, 160);
    const category = clampStr(body.category, 80);
    const description = clampStr(body.description, 4000);
    const region = clampStr(body.region, 80);
    const requirements = Array.isArray(body.requirements)
      ? body.requirements.map((r) => clampStr(r, 160)).filter(Boolean).slice(0, 20)
      : [];
    const salary = clampStr(body.salary, 40);
    const language = normLang(body.language);
    if (!title && !description && !category) {
      throw new BadRequestException('Kamida sarlavha yoki tavsif kiriting');
    }

    const system =
      "You are an assistant that writes clear, professional, honest job vacancies for the Mehrli qo'llar platform in Uzbekistan. " +
      'Output a concise vacancy with: a short intro, responsibilities, requirements, and what the employer offers. ' +
      'Do not invent salary, contacts, or facts not provided. ' +
      this.ai.languageRule(language);

    const user = [
      `Title: ${title || '-'}`,
      `Category: ${category || '-'}`,
      `Region: ${region || '-'}`,
      `Salary: ${salary || '-'}`,
      `Requirements: ${requirements.length ? requirements.join('; ') : '-'}`,
      `Draft/notes: ${description || '-'}`,
      '',
      'Write an improved vacancy text based on the above.',
    ].join('\n');

    const result = await this.ai.complete({
      system,
      user,
      maxTokens: 800,
      mockFallback: () =>
        this.mockVacancy(title, category, region, salary, requirements, description),
    });
    return { text: result.text, provider: result.provider };
  }

  /**
   * Employer: recommend matching workers by profession + distance with a
   * deterministic match score. Only public fields and approximate distance are
   * returned (never exact coordinates / confidential data).
   */
  @Roles('employer', 'super_admin')
  @Post('employer/match')
  async match(
    @Body()
    body: {
      profession?: string;
      skills?: string[];
      region?: string;
      lat?: number;
      lng?: number;
      radiusKm?: number;
      limit?: number;
    },
  ) {
    const skills = [
      ...(body.profession ? [clampStr(body.profession, 80)] : []),
      ...(Array.isArray(body.skills) ? body.skills.map((s) => clampStr(s, 80)) : []),
    ]
      .map((s) => s.toLowerCase())
      .filter(Boolean);
    const region = clampStr(body.region, 80);
    const limit = Math.min(50, Math.max(1, Number(body.limit) || 10));
    const hasGeo = isValidLatLng(body.lat, body.lng);
    const radiusKm = Math.min(300, Math.max(1, Number(body.radiusKm) || 50));

    const where: Record<string, unknown> = { role: 'worker', lookingForWork: true };
    if (region) where.region = region;
    if (hasGeo) {
      const box = boundingBox(body.lat as number, body.lng as number, radiusKm);
      where.locationSharingEnabled = true;
      where.latitude = { gte: box.minLat, lte: box.maxLat };
      where.longitude = { gte: box.minLng, lte: box.maxLng };
    }

    const rows = await this.prisma.user.findMany({
      where: where as any,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        photoUrl: true,
        phoneNumber: true,
        region: true,
        district: true,
        skills: true,
        experienceLevel: true,
        isVerified: true,
        rating: true,
        latitude: true,
        longitude: true,
      },
      take: 2000,
    });

    const scored = rows
      .map((r) => {
        const workerSkills = (r.skills || []).map((s) => s.toLowerCase());
        const overlap = skills.length
          ? skills.filter((s) => workerSkills.some((ws) => ws.includes(s) || s.includes(ws))).length
          : 0;
        const professionScore = skills.length ? overlap / skills.length : 0.5;

        let distanceKm: number | null = null;
        let distanceScore = 0.5;
        if (hasGeo && r.latitude != null && r.longitude != null) {
          distanceKm = haversineKm(body.lat as number, body.lng as number, r.latitude, r.longitude);
          if (distanceKm > radiusKm) return null;
          distanceScore = Math.max(0, 1 - distanceKm / radiusKm);
        }

        const verifiedBonus = r.isVerified ? 0.1 : 0;
        const ratingScore = Math.min(1, (r.rating || 0) / 5) * 0.1;
        const score = Math.round(
          (professionScore * 0.6 + distanceScore * 0.3 + verifiedBonus + ratingScore) * 100,
        );

        return {
          uid: r.id,
          firstName: r.firstName,
          lastName: r.lastName,
          fullName: r.fullName,
          photoUrl: r.photoUrl,
          phoneNumber: r.phoneNumber,
          region: r.region,
          district: r.district,
          skills: r.skills,
          experienceLevel: r.experienceLevel,
          isVerified: r.isVerified,
          rating: r.rating,
          matchScore: Math.min(100, score),
          matchedSkills: skills.length
            ? workerSkills.filter((ws) => skills.some((s) => ws.includes(s) || s.includes(ws)))
            : [],
          distanceKm: distanceKm != null ? Math.round(distanceKm * 10) / 10 : undefined,
          distanceLabel:
            distanceKm != null ? `~${Math.max(1, Math.round(distanceKm))} km` : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    return { data: scored, total: scored.length, aiProvider: this.ai.getProvider() };
  }

  /** Worker: resume improvement suggestions from the worker's own profile. */
  @Roles('worker', 'super_admin')
  @Post('worker/resume')
  async resume(
    @Body() body: { userId?: string; language?: string },
    @Req() req: { user: AuthUser },
  ) {
    const targetId = clampStr(body.userId, 64) || req.user.userId;
    if (targetId !== req.user.userId && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Faqat o\'z rezyumeingiz uchun');
    }
    const user = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    const language = normLang(body.language);

    const profile = {
      professionalSummary: user.professionalSummary || user.bio || '',
      skills: user.skills || [],
      experienceLevel: user.experienceLevel || '',
      education: Array.isArray(user.education) ? user.education.length : 0,
      experience: Array.isArray(user.experience) ? user.experience.length : 0,
      certificates: Array.isArray(user.certificates) ? user.certificates.length : 0,
      region: user.region || '',
    };

    const system =
      'You are a career coach for blue-collar and service workers in Uzbekistan. ' +
      'Give concrete, actionable suggestions to improve the resume/profile below. ' +
      'Be encouraging and specific. Use short bullet points. ' +
      this.ai.languageRule(language);
    const userPrompt = `Worker profile (JSON):\n${JSON.stringify(profile)}\n\nList the top improvements.`;

    const result = await this.ai.complete({
      system,
      user: userPrompt,
      maxTokens: 600,
      mockFallback: () => this.mockResume(profile, language),
    });
    return { text: result.text, provider: result.provider };
  }

  /**
   * Super Admin: advisory summary of a worker's risk indicators. PII is
   * anonymized before being sent to the AI provider. Advisory only — the final
   * decision must be made by a human.
   */
  @Roles('super_admin')
  @Post('admin/risk-summary/:id')
  async riskSummary(
    @Param('id') id: string,
    @Body() body: { language?: string },
    @Req() req: { user: AuthUser },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    if (user.role !== 'worker') {
      throw new BadRequestException('Indikatorlar faqat ishchi uchun');
    }
    const language = normLang(body.language);
    const ci = (user.coreIndicators || null) as Record<string, unknown> | null;
    if (!ci) {
      return {
        text: 'Indikatorlar kiritilmagan.',
        provider: 'mock' as const,
        advisory: true,
      };
    }

    // Anonymize: only indicator levels / qualitative values, no names/contacts/addresses.
    const anonymized = {
      familyIncome: ci.familyIncome ?? null,
      motherSocialStatus: ci.motherSocialStatus ?? null,
      educationResults: ci.educationResults ?? null,
      attendance: ci.attendance ?? null,
      healthStatus: ci.healthStatus ?? null,
      psychologicalState: ci.psychologicalState ?? null,
      disabilityStatus: ci.disabilityStatus ?? null,
      earlyMarriageRisk: ci.earlyMarriageRisk ?? null,
      violenceRisk: ci.violenceRisk ?? null,
      digitalLiteracy: ci.digitalLiteracy ?? null,
    };

    const system =
      'You are a social-support analyst. Based ONLY on the anonymized indicators below, ' +
      'write a brief, non-judgmental advisory summary highlighting potential support needs and risk level. ' +
      'Do NOT identify the person. State clearly that this is advisory and the final decision must be made by a human. ' +
      this.ai.languageRule(language);
    const userPrompt = `Anonymized indicators (JSON):\n${JSON.stringify(anonymized)}`;

    const result = await this.ai.complete({
      system,
      user: userPrompt,
      maxTokens: 500,
      mockFallback: () => this.mockRiskSummary(anonymized, language),
    });

    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'AI_RISK_SUMMARY',
          userId: req.user.userId,
          details: { targetUserId: id, provider: result.provider },
          type: 'info',
        },
      })
      .catch(() => undefined);

    return { text: result.text, provider: result.provider, advisory: true };
  }

  // ---- Deterministic mock fallbacks (used when no AI key is configured) ----

  private mockVacancy(
    title: string,
    category: string,
    region: string,
    salary: string,
    requirements: string[],
    description: string,
  ): string {
    const lines = [
      `**${title || category || 'Vakansiya'}**`,
      '',
      description || `${region ? region + 'da ' : ''}${category || 'ish'} bo'yicha xodim kerak.`,
      '',
      'Vazifalar:',
      '- Belgilangan ishlarni sifatli va o\'z vaqtida bajarish',
      '- Jamoaga mas\'uliyat bilan yondashish',
      '',
      'Talablar:',
      ...(requirements.length ? requirements.map((r) => `- ${r}`) : ['- Tegishli tajriba afzallik']),
      '',
      'Taklif etamiz:',
      `- To'lov: ${salary || 'kelishilgan holda'}`,
      '- Qulay ish sharoiti',
    ];
    return lines.join('\n');
  }

  private mockResume(
    profile: { skills: string[]; professionalSummary: string; education: number; experience: number; certificates: number },
    language: AiLanguage,
  ): string {
    const tips: string[] = [];
    if (!profile.professionalSummary) tips.push("- Qisqa professional tavsif (summary) qo'shing.");
    if ((profile.skills?.length ?? 0) < 3) tips.push('- Kamida 3-5 ta ko\'nikma qo\'shing.');
    if (profile.experience === 0) tips.push('- Ish tajribangizni kiriting.');
    if (profile.education === 0) tips.push("- Ta'lim ma'lumotlarini to'ldiring.");
    if (profile.certificates === 0) tips.push('- Sertifikatlar yoki kurslarni qo\'shing.');
    if (!tips.length) tips.push('- Profilingiz yaxshi to\'ldirilgan. Rasm va aniq misollar qo\'shing.');
    const header =
      language === 'ru' ? 'Рекомендации по резюме:' : language === 'en' ? 'Resume tips:' : 'Rezyume bo\'yicha tavsiyalar:';
    return [header, ...tips].join('\n');
  }

  private mockRiskSummary(anon: Record<string, unknown>, language: AiLanguage): string {
    const high = Object.entries(anon).filter(([, v]) => v === 'high' || v === 'critical');
    const header =
      language === 'ru'
        ? 'Консультативное резюме (решение принимает человек):'
        : language === 'en'
          ? 'Advisory summary (final decision by a human):'
          : 'Maslahat xulosa (yakuniy qarorni inson qabul qiladi):';
    const body = high.length
      ? `Diqqat talab qiladigan sohalar: ${high.map(([k]) => k).join(', ')}.`
      : "Yuqori darajadagi xavf aniqlanmadi.";
    return `${header}\n${body}`;
  }
}
