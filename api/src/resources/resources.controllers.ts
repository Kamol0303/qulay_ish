import { BadRequestException, Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { randomUUID } from 'crypto';

/** Strip identity / private verification docs from public profile payloads */
function toPublicUser(user: Record<string, unknown>, opts?: { includePrivateDocs?: boolean }) {
  const {
    passwordHash: _p,
    companyDocuments,
    ...rest
  } = user;
  if (opts?.includePrivateDocs) {
    return { ...rest, companyDocuments };
  }
  return rest;
}

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
  ) {
    const rows = await this.prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(region ? { region } : {}),
        ...(district ? { district } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => toPublicUser(u as unknown as Record<string, unknown>));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    // Public profiles never expose company/identity verification documents.
    // Owners load private docs via /auth/me; Super Admin via Verification Center.
    return toPublicUser(user as unknown as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: { user: { userId: string; role: string } }) {
    if (req.user.userId !== id && !['admin', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException();
    }

    const allowed = [
      'fullName', 'email', 'phoneNumber', 'region', 'district', 'neighborhood',
      'bio', 'skills', 'photoUrl', 'coverUrl', 'telegram', 'languages',
      'availability', 'lookingForWork', 'professionalSummary', 'preferredContact',
      'experienceLevel', 'education', 'experience', 'certificates', 'portfolio',
      'resumeTemplate', 'companyName', 'businessType', 'industry',
      'registrationNumber', 'tin', 'website', 'foundedYear', 'employeeCount',
      'officeAddress', 'companyGallery', 'companyDocuments', 'recruiterContacts',
      'isPremium',
    ] as const;

    // Moderators/admins may block users, but only Super Admin can change verification flags
    const adminOnly = [
      'isBlocked', 'blockUntil', 'blockReason', 'blockedAt', 'trustScore', 'riskScore',
    ] as const;
    const superOnly = ['isVerified', 'verificationStatus', 'role'] as const;

    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }
    if (['admin', 'super_admin'].includes(req.user.role)) {
      for (const key of adminOnly) {
        if (key in body) data[key] = body[key];
      }
    }
    if (req.user.role === 'super_admin') {
      for (const key of superOnly) {
        if (key in body) data[key] = body[key];
      }
    }

    return this.prisma.user.update({ where: { id }, data: data as any });
  }
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (query.employerId) where.employerId = query.employerId;
    if (query.status) where.status = query.status;
    if (query.region) where.region = query.region;
    return this.prisma.job.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.job.findUniqueOrThrow({ where: { id } });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: { userId: string } }) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.job.create({
      data: {
        id,
        title: String(body.title || ''),
        description: body.description as string,
        employerId: String(body.employerId || req.user.userId),
        employerName: body.employerName as string,
        category: body.category as string,
        region: body.region as string,
        district: body.district as string,
        neighborhood: body.neighborhood as string,
        salary: body.salary as number,
        price: body.price as number,
        salaryType: body.salaryType as string,
        workType: body.workType as string,
        status: (body.status as any) || 'active',
        isPromoted: Boolean(body.isPromoted),
        requirements: (body.requirements as string[]) || [],
        images: (body.images as string[]) || [],
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.job.update({ where: { id }, data: body as any });
  }
}

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (query.jobId) where.jobId = query.jobId;
    if (query.workerId) where.workerId = query.workerId;
    if (query.employerId) where.employerId = query.employerId;
    if (query.status) where.status = query.status;
    return this.prisma.application.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.application.findUniqueOrThrow({ where: { id } });
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

    const worker = await this.prisma.user.findUnique({ where: { id: workerId } });
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
        link: `/employer/applicants?highlight=${created.id}`,
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
        link: '/worker/applications',
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
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        ...(status ? { status: status as any } : {}),
        ...(body.message !== undefined ? { message: body.message as string } : {}),
        ...(body.coverLetter !== undefined ? { coverLetter: body.coverLetter as string } : {}),
      },
    });

    if (status === 'accepted' || status === 'rejected') {
      await this.prisma.notification.create({
        data: {
          id: randomUUID(),
          userId: existing.workerId,
          title: status === 'accepted' ? 'Ariza qabul qilindi' : 'Ariza rad etildi',
          message:
            status === 'accepted'
              ? `Sizning "${existing.jobTitle || 'ish'}" arizangiz qabul qilindi!`
              : `Sizning "${existing.jobTitle || 'ish'}" arizangiz rad etildi`,
          type: 'application',
          link: '/worker/applications',
          read: false,
        },
      });
    }

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
  if (!partial || body.startDate !== undefined) {
    maybeSet('startDate', body.startDate ? new Date(String(body.startDate)) : null);
  }
  if (!partial || body.endDate !== undefined) {
    maybeSet('endDate', body.endDate ? new Date(String(body.endDate)) : null);
  }
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
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const where: Record<string, unknown> = {};
    if (query.workerId) where.workerId = query.workerId;
    if (query.employerId) where.employerId = query.employerId;
    if (query.status) where.status = query.status;
    const rows = await this.prisma.contract.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => toContractDto(row as unknown as Record<string, unknown>));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const row = await this.prisma.contract.findUniqueOrThrow({ where: { id } });
    return toContractDto(row as unknown as Record<string, unknown>);
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

    // Enrich names/title when missing
    const [worker, employer, job] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: String(data.workerId) } }),
      this.prisma.user.findUnique({ where: { id: String(data.employerId) } }),
      data.jobId
        ? this.prisma.job.findUnique({ where: { id: String(data.jobId) } })
        : Promise.resolve(null),
    ]);
    if (!worker) throw new BadRequestException('Ishchi topilmadi');
    if (!employer) throw new BadRequestException('Ish beruvchi topilmadi');

    const id = (body.id as string) || randomUUID();
    const created = await this.prisma.contract.create({
      data: {
        id,
        ...data,
        workerName: (data.workerName as string) || worker.fullName || null,
        employerName: (data.employerName as string) || employer.fullName || null,
        jobTitle: (data.jobTitle as string) || job?.title || null,
        amount:
          data.amount != null
            ? Number(data.amount)
            : job?.price != null
              ? Number(job.price)
              : null,
        status: (data.status as any) || 'draft',
        signedByWorker: Boolean(data.signedByWorker),
        signedByEmployer: Boolean(data.signedByEmployer),
        adminApproved: false,
      } as any,
    });

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
          message: `${created.employerName || 'Ish beruvchi'} — "${jobTitle}" shartnomasi tekshiruvga yuborildi`,
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
        },
        type: 'info',
      },
    });

    return toContractDto(created as unknown as Record<string, unknown>);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const data = normalizeContractWrite(body, { partial: true });
    // Never let client force unknown Prisma keys (workerSigned etc.)
    delete (data as any).workerSigned;
    delete (data as any).employerSigned;
    const updated = await this.prisma.contract.update({
      where: { id },
      data: data as any,
    });
    return toContractDto(updated as unknown as Record<string, unknown>);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('userId') userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.notification.create({ data: { id, ...body } as any });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.notification.update({ where: { id }, data: body as any });
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

  @Get()
  async list(@Query('userA') userA: string, @Query('userB') userB: string) {
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
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.chatMessage.update({ where: { id }, data: body as any });
  }
}

@Controller('disputes')
export class DisputesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    const dispute = await this.prisma.dispute.create({ data: { id, ...body } as any });
    if (body.contractId) {
      await this.prisma.contract.update({
        where: { id: String(body.contractId) },
        data: { status: 'disputed' },
      });
    }
    return dispute;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.dispute.update({ where: { id }, data: body as any });
  }
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('revieweeId') revieweeId?: string, @Query('workerId') workerId?: string) {
    const id = revieweeId || workerId;
    return this.prisma.review.findMany({
      where: id ? { revieweeId: id } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.review.create({ data: { id, ...body } as any });
  }
}

@Controller('saved-jobs')
export class SavedJobsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('userId') userId: string) {
    return this.prisma.savedJob.findMany({
      where: { userId },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: { userId: string; jobId: string }) {
    const id = randomUUID();
    return this.prisma.savedJob.create({ data: { id, userId: body.userId, jobId: body.jobId } });
  }

  @UseGuards(JwtAuthGuard)
  @Post('delete')
  async remove(@Body() body: { userId: string; jobId: string }) {
    await this.prisma.savedJob.deleteMany({ where: { userId: body.userId, jobId: body.jobId } });
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
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.servicePost.create({ data: { id, ...body } as any });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.servicePost.update({ where: { id }, data: body as any });
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('userId') userId?: string) {
    return this.prisma.payment.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.payment.create({ data: { id, ...body } as any });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.payment.update({ where: { id }, data: body as any });
  }
}

@Controller('violations')
export class ViolationsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.violation.create({ data: { id, ...body } as any });
  }
}

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly prisma: PrismaService) {}

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
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.activityLog.create({ data: { id, ...body } as any });
  }
}

@Controller('system-logs')
export class SystemLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.systemLog.create({ data: { id, ...body } as any });
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('global')
  async getGlobal() {
    return this.prisma.globalSettings.findUnique({ where: { id: 'global_config' } });
  }

  @UseGuards(JwtAuthGuard)
  @Patch('global')
  async updateGlobal(@Body() body: Record<string, unknown>) {
    return this.prisma.globalSettings.upsert({
      where: { id: 'global_config' },
      create: { id: 'global_config', ...body } as any,
      update: body as any,
    });
  }
}

@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('counts')
  async counts() {
    const [users, jobs, applications, contracts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.job.count(),
      this.prisma.application.count(),
      this.prisma.contract.count(),
    ]);
    return { users, jobs, applications, contracts };
  }
}
