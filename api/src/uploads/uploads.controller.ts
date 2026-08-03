import {
  Controller,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Body,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
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

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

const ALLOWED = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.pdf',
  '.mp4',
  '.webm',
  '.doc',
  '.docx',
]);

function ensureDir(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
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
          const dir = join(UPLOAD_ROOT, userId);
          ensureDir(dir);
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname || '').toLowerCase() || '.bin';
          cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`);
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

    const url = `/uploads/${req.user.userId}/${file.filename}`;
    const kind = (body.kind || 'file').trim();

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
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':filename')
  async remove(
    @Param('filename') filename: string,
    @Req() req: { user: { userId: string } },
    @Body() body: { kind?: string },
  ) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const full = join(UPLOAD_ROOT, req.user.userId, safe);
    if (existsSync(full)) {
      try {
        unlinkSync(full);
      } catch {
        /* ignore */
      }
    }

    if (body.kind === 'photo') {
      await this.prisma.user.update({
        where: { id: req.user.userId },
        data: { photoUrl: null },
      });
    } else if (body.kind === 'cover') {
      await this.prisma.user.update({
        where: { id: req.user.userId },
        data: { coverUrl: null },
      });
    }

    return { success: true };
  }
}
