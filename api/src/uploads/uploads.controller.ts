import {
  Controller,
  Post,
  Delete,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Req,
  Res,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { createReadStream, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

type UploadedMulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
};

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const PRIVATE_ROOT = join(UPLOAD_ROOT, 'private');
export const PUBLIC_ROOT = join(UPLOAD_ROOT, 'public');

const ALLOWED = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.mp4', '.webm', '.doc', '.docx',
]);

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function isVerificationKind(kind: string) {
  return kind === 'verification' || kind.startsWith('verification_');
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const userId = (req as { user?: { userId?: string } }).user?.userId || 'anon';
          const kind = String((req.body as { kind?: string })?.kind || 'file');
          const root = isVerificationKind(kind) ? join(PRIVATE_ROOT, userId) : join(PUBLIC_ROOT, userId);
          ensureDir(root);
          cb(null, root);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase() || '.bin';
          const prefix = 'file';
          cb(null, `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
        },
      }),
      limits: { fileSize: 12 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        if (!ALLOWED.has(ext)) {
          cb(new BadRequestException('Fayl turi qo\'llab-quvvatlanmaydi') as unknown as Error, false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Req() req: { user: { userId: string } },
    @Body() body: { kind?: string },
  ) {
    if (!file) throw new BadRequestException('Fayl yuklanmadi');

    const kind = (body.kind || 'file').trim();
    const privateFile = isVerificationKind(kind);
    const url = privateFile
      ? `/api/uploads/private/${req.user.userId}/${file.filename}`
      : `/uploads/public/${req.user.userId}/${file.filename}`;

    if (kind === 'photo') {
      await this.prisma.user.update({
        where: { id: req.user.userId },
        data: { photoUrl: url },
      });
    } else if (kind === 'cover') {
      await this.prisma.user.update({
        where: { id: req.user.userId },
        data: { coverUrl: url },
      });
    }

    return {
      success: true,
      url,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind,
      private: privateFile,
    };
  }

  /** Owner or super_admin only — private verification docs */
  @UseGuards(JwtAuthGuard)
  @Get('private/:userId/:filename')
  async getPrivate(
    @Param('userId') userId: string,
    @Param('filename') filename: string,
    @Req() req: { user: { userId: string; role: string } },
    @Res() res: Response,
  ) {
    const isOwner = req.user.userId === userId;
    const isSuper = req.user.role === 'super_admin';
    if (!isOwner && !isSuper) throw new ForbiddenException('Ruxsat yo\'q');

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const full = join(PRIVATE_ROOT, userId, safeName);
    if (!existsSync(full)) throw new NotFoundException('Fayl topilmadi');

    res.setHeader('Cache-Control', 'private, no-store');
    return createReadStream(full).pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':filename')
  async remove(
    @Param('filename') filename: string,
    @Req() req: { user: { userId: string } },
    @Body() body: { kind?: string },
    @Query('scope') scope?: string,
  ) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const root = scope === 'private' || isVerificationKind(body.kind || '')
      ? join(PRIVATE_ROOT, req.user.userId)
      : join(PUBLIC_ROOT, req.user.userId);
    const full = join(root, safe);
    if (existsSync(full)) {
      try {
        unlinkSync(full);
      } catch {
        /* ignore */
      }
    }

    if (body.kind === 'photo') {
      await this.prisma.user.update({ where: { id: req.user.userId }, data: { photoUrl: null } });
    } else if (body.kind === 'cover') {
      await this.prisma.user.update({ where: { id: req.user.userId }, data: { coverUrl: null } });
    }

    return { success: true };
  }
}
