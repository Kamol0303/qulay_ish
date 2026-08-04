import { BadRequestException } from '@nestjs/common';

export type PassportDataPayload = {
  series: string;
  number: string;
  pinfl: string;
  fullName: string;
  issueDate: string;
  expiryDate: string;
};

const SERIES_RE = /^[A-Z]{2}$/;
const NUMBER_RE = /^\d{7}$/;
const PINFL_RE = /^\d{14}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function trimStr(v: unknown, max: number): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function normalizeSeries(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

function normalizeDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function sanitizePassportData(raw: unknown): PassportDataPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Pasport ma\'lumotlari majburiy');
  }
  const body = raw as Record<string, unknown>;

  const series = normalizeSeries(trimStr(body.series, 8));
  const number = normalizeDigits(trimStr(body.number, 16));
  const pinfl = normalizeDigits(trimStr(body.pinfl, 20));
  const fullName = trimStr(body.fullName, 120);
  const issueDate = trimStr(body.issueDate, 16);
  const expiryDate = trimStr(body.expiryDate, 16);

  if (!SERIES_RE.test(series)) {
    throw new BadRequestException('Pasport seriyasi 2 ta harf bo\'lishi kerak (masalan: AA)');
  }
  if (!NUMBER_RE.test(number)) {
    throw new BadRequestException('Pasport raqami 7 ta raqam bo\'lishi kerak');
  }
  if (!PINFL_RE.test(pinfl)) {
    throw new BadRequestException('JSHSHIR (PINFL) 14 ta raqam bo\'lishi kerak');
  }
  if (fullName.length < 3) {
    throw new BadRequestException('Pasportdagi to\'liq ism majburiy');
  }
  if (!DATE_RE.test(issueDate) || !DATE_RE.test(expiryDate)) {
    throw new BadRequestException('Berilgan / amal qilish sanalari YYYY-MM-DD formatida bo\'lishi kerak');
  }

  const issue = new Date(`${issueDate}T00:00:00Z`);
  const expiry = new Date(`${expiryDate}T00:00:00Z`);
  if (Number.isNaN(issue.getTime()) || Number.isNaN(expiry.getTime())) {
    throw new BadRequestException('Sana noto\'g\'ri');
  }
  if (expiry <= issue) {
    throw new BadRequestException('Amal qilish muddati berilgan sanadan keyin bo\'lishi kerak');
  }
  if (expiry < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
    throw new BadRequestException('Pasport muddati tugagan');
  }

  return { series, number, pinfl, fullName, issueDate, expiryDate };
}
