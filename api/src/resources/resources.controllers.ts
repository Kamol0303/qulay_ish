import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { randomUUID } from 'crypto';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('role') role?: string,
    @Query('region') region?: string,
    @Query('district') district?: string,
  ) {
    return this.prisma.user.findMany({
      where: {
        ...(role ? { role: role as any } : {}),
        ...(region ? { region } : {}),
        ...(district ? { district } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: { user: { userId: string; role: string } }) {
    if (req.user.userId !== id && !['admin', 'super_admin'].includes(req.user.role)) {
      throw new ForbiddenException();
    }
    const { passwordHash, ...data } = body;
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
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.application.create({
      data: {
        id,
        jobId: String(body.jobId),
        workerId: String(body.workerId),
        employerId: String(body.employerId),
        workerName: body.workerName as string,
        jobTitle: body.jobTitle as string,
        message: body.message as string,
        coverLetter: body.coverLetter as string,
        status: (body.status as any) || 'pending',
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.application.update({ where: { id }, data: body as any });
  }
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
    return this.prisma.contract.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.prisma.contract.findUniqueOrThrow({ where: { id } });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.contract.create({ data: { id, ...body } as any });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.contract.update({ where: { id }, data: body as any });
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

  @Get()
  async list(@Query('userA') userA: string, @Query('userB') userB: string) {
    return this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userA, receiverId: userB },
          { senderId: userB, receiverId: userA },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    const content = String(body.content || body.message || body.text || '');
    return this.prisma.chatMessage.create({
      data: {
        id,
        senderId: String(body.senderId),
        receiverId: String(body.receiverId),
        content,
        read: Boolean(body.read),
        delivered: Boolean(body.delivered),
        status: body.status as string,
        jobId: body.jobId as string,
        contractId: body.contractId as string,
      },
    });
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

@Controller('verification-requests')
export class VerificationRequestsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query('userId') userId?: string, @Query('status') status?: string) {
    return this.prisma.verificationRequest.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const id = (body.id as string) || randomUUID();
    return this.prisma.verificationRequest.create({ data: { id, ...body } as any });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.prisma.verificationRequest.update({ where: { id }, data: body as any });
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
