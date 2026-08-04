import { BadRequestException } from '@nestjs/common';
import { readFileSync, statSync } from 'fs';

export type DocumentCheckRole = 'id' | 'selfie' | 'other';

export type DocumentCheckResult = {
  ok: boolean;
  role: DocumentCheckRole;
  mimeGuess: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
  score: number;
};

function readMagic(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return 'unknown';
}

function readPngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    // SOF0 / SOF2
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function readWebpSize(buf: Buffer): { width: number; height: number } | null {
  // VP8X
  if (buf.length >= 30 && buf.toString('ascii', 12, 16) === 'VP8X') {
    const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
    const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
    return { width, height };
  }
  // VP8 lossy
  if (buf.length >= 30 && buf.toString('ascii', 12, 16) === 'VP8 ') {
    const width = buf.readUInt16LE(26) & 0x3fff;
    const height = buf.readUInt16LE(28) & 0x3fff;
    return { width, height };
  }
  return null;
}

function imageDimensions(buf: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png') return readPngSize(buf);
  if (mime === 'image/jpeg') return readJpegSize(buf);
  if (mime === 'image/webp') return readWebpSize(buf);
  return null;
}

/**
 * Lightweight document authenticity / format checks (no external OCR deps).
 * Validates magic bytes, size, dimensions and ID-like aspect ratios.
 */
export function validateIdentityDocumentFile(
  filePath: string,
  role: DocumentCheckRole,
  declaredMime?: string,
): DocumentCheckResult {
  const checks: DocumentCheckResult['checks'] = [];
  let score = 0;

  let sizeBytes = 0;
  try {
    sizeBytes = statSync(filePath).size;
  } catch {
    throw new BadRequestException('Fayl o\'qib bo\'lmadi');
  }

  const head = readFileSync(filePath).subarray(0, Math.min(sizeBytes, 512 * 1024));
  const mimeGuess = readMagic(head);

  const magicOk = mimeGuess !== 'unknown';
  checks.push({
    id: 'magic_bytes',
    passed: magicOk,
    detail: magicOk ? `Format: ${mimeGuess}` : 'Fayl formati aniqlanmadi (JPEG/PNG/WEBP/PDF talab qilinadi)',
  });
  if (magicOk) score += 25;

  if (declaredMime && mimeGuess !== 'unknown' && !declaredMime.includes(mimeGuess.split('/')[1] || '')) {
    // soft mismatch — still allow if magic is solid
    checks.push({
      id: 'mime_match',
      passed: true,
      detail: `Declared ${declaredMime}, detected ${mimeGuess}`,
    });
  }

  const minBytes = role === 'id' ? 25_000 : role === 'selfie' ? 15_000 : 8_000;
  const sizeOk = sizeBytes >= minBytes && sizeBytes <= 12 * 1024 * 1024;
  checks.push({
    id: 'file_size',
    passed: sizeOk,
    detail: sizeOk
      ? `${Math.round(sizeBytes / 1024)} KB`
      : `Fayl hajmi mos emas (min ${Math.round(minBytes / 1024)} KB)`,
  });
  if (sizeOk) score += 20;

  let width: number | undefined;
  let height: number | undefined;

  if (mimeGuess.startsWith('image/')) {
    const dims = imageDimensions(head, mimeGuess);
    if (dims) {
      width = dims.width;
      height = dims.height;
      const minW = role === 'id' ? 600 : 400;
      const minH = role === 'id' ? 400 : 400;
      const dimOk = width >= minW && height >= minH;
      checks.push({
        id: 'dimensions',
        passed: dimOk,
        detail: dimOk
          ? `${width}×${height}`
          : `Rasm juda kichik (${width}×${height}). Min: ${minW}×${minH}`,
      });
      if (dimOk) score += 25;

      const ratio = width / Math.max(height, 1);
      if (role === 'id') {
        const ratioOk = ratio >= 1.15 && ratio <= 2.2;
        checks.push({
          id: 'id_aspect',
          passed: ratioOk,
          detail: ratioOk
            ? `Aspect ${ratio.toFixed(2)} (ID/pasport ko‘rinishi)`
            : `Aspect ${ratio.toFixed(2)} — pasport/ID odatda gorizontal bo‘ladi`,
        });
        if (ratioOk) score += 20;
      } else if (role === 'selfie') {
        const ratioOk = ratio >= 0.55 && ratio <= 1.6;
        checks.push({
          id: 'selfie_aspect',
          passed: ratioOk,
          detail: ratioOk
            ? `Aspect ${ratio.toFixed(2)}`
            : `Selfi nisbati noodatiy (${ratio.toFixed(2)})`,
        });
        if (ratioOk) score += 20;
      }
    } else {
      checks.push({
        id: 'dimensions',
        passed: false,
        detail: 'Rasm o‘lchamlari o\'qilmadi',
      });
    }
  } else if (mimeGuess === 'application/pdf') {
    // PDF allowed for ID docs only
    const pdfOk = role === 'id' || role === 'other';
    checks.push({
      id: 'pdf_allowed',
      passed: pdfOk,
      detail: pdfOk ? 'PDF hujjat' : 'Selfi uchun PDF qabul qilinmaydi',
    });
    if (pdfOk) score += 30;
    if (!pdfOk) {
      throw new BadRequestException('Selfi uchun rasm (JPEG/PNG/WEBP) yuklang');
    }
  }

  // Entropy-ish heuristic: avoid near-empty / solid-color tiny payloads
  if (head.length > 256 && mimeGuess.startsWith('image/')) {
    const sample = head.subarray(0, Math.min(head.length, 4096));
    const uniq = new Set(sample);
    const varietyOk = uniq.size > 32;
    checks.push({
      id: 'content_variety',
      passed: varietyOk,
      detail: varietyOk
        ? 'Rasm kontenti yetarli'
        : 'Rasm juda oddiy / bo‘sh ko‘rinadi — aniqroq surat yuklang',
    });
    if (varietyOk) score += 10;
  }

  const criticalFailed = checks.some(
    (c) =>
      !c.passed &&
      (c.id === 'magic_bytes' || c.id === 'file_size' || c.id === 'dimensions' || c.id === 'pdf_allowed'),
  );

  const result: DocumentCheckResult = {
    ok: !criticalFailed && score >= 50,
    role,
    mimeGuess,
    sizeBytes,
    width,
    height,
    checks,
    score,
  };

  if (!result.ok) {
    const firstFail = checks.find((c) => !c.passed)?.detail || 'Hujjat tekshiruvidan o\'tmadi';
    throw new BadRequestException(firstFail);
  }

  return result;
}
