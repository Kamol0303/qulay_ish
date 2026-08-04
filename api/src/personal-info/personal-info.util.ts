import { BadRequestException } from '@nestjs/common';

export type PersonalInfoPayload = {
  fullName?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  maritalStatus?: string;
  childrenStatus?: string;
  childrenCount?: number;
  profession?: string;
  specialty?: string;
  educationLevel?: string;
  nationality?: string;
  citizenship?: string;
  currentAddress?: string;
  permanentAddress?: string;
  phone?: string;
  additionalPhone?: string;
  email?: string;
  about?: string;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByRole?: string;
};

const REQUIRED = [
  'fullName',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'childrenStatus',
  'profession',
  'specialty',
  'educationLevel',
  'citizenship',
  'currentAddress',
  'phone',
  'email',
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+998\d{9}$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  return input.trim();
}

function calcAge(dateOfBirth: string): number | undefined {
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 120) return undefined;
  return age;
}

function trimStr(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

/** Validate + normalize personal info for storage */
export function sanitizePersonalInfo(
  raw: unknown,
  audit: { userId: string; role: string },
): PersonalInfoPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Shaxsiy ma\'lumotlar noto\'g\'ri formatda');
  }
  const body = raw as Record<string, unknown>;
  const out: PersonalInfoPayload = {};

  out.fullName = trimStr(body.fullName, 120);
  out.dateOfBirth = trimStr(body.dateOfBirth, 32);
  out.gender = trimStr(body.gender, 32);
  out.maritalStatus = trimStr(body.maritalStatus, 32);
  out.childrenStatus = trimStr(body.childrenStatus, 32);
  out.profession = trimStr(body.profession, 120);
  out.specialty = trimStr(body.specialty, 120);
  out.educationLevel = trimStr(body.educationLevel, 120);
  out.nationality = trimStr(body.nationality, 80);
  out.citizenship = trimStr(body.citizenship, 80);
  out.currentAddress = trimStr(body.currentAddress, 300);
  out.permanentAddress = trimStr(body.permanentAddress, 300);
  out.about = trimStr(body.about, 2000);
  out.notes = trimStr(body.notes, 2000);

  if (body.phone != null && String(body.phone).trim()) {
    out.phone = normalizePhone(String(body.phone));
  }
  if (body.additionalPhone != null && String(body.additionalPhone).trim()) {
    out.additionalPhone = normalizePhone(String(body.additionalPhone));
  }
  if (body.email != null) {
    out.email = trimStr(body.email, 160)?.toLowerCase();
  }

  if (body.childrenCount != null && body.childrenCount !== '') {
    const n = Number(body.childrenCount);
    if (!Number.isFinite(n) || n < 0 || n > 30) {
      throw new BadRequestException('Farzandlar soni noto\'g\'ri');
    }
    out.childrenCount = Math.floor(n);
  }

  for (const key of REQUIRED) {
    if (!out[key]) {
      throw new BadRequestException(`Majburiy maydon: ${key}`);
    }
  }

  if (out.dateOfBirth && !DOB_RE.test(out.dateOfBirth)) {
    throw new BadRequestException('Tug\'ilgan sana YYYY-MM-DD formatida bo\'lishi kerak');
  }
  if (out.dateOfBirth) {
    const dob = new Date(out.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      throw new BadRequestException('Tug\'ilgan sana noto\'g\'ri');
    }
    out.age = calcAge(out.dateOfBirth);
  }

  if (out.email && !EMAIL_RE.test(out.email)) {
    throw new BadRequestException('Email noto\'g\'ri');
  }
  if (out.phone && !PHONE_RE.test(out.phone)) {
    throw new BadRequestException('Telefon +998XXXXXXXXX formatida bo\'lishi kerak');
  }
  if (out.additionalPhone && !PHONE_RE.test(out.additionalPhone)) {
    throw new BadRequestException('Qo\'shimcha telefon +998XXXXXXXXX formatida bo\'lishi kerak');
  }

  if (out.childrenStatus === 'has_children' && (out.childrenCount == null || out.childrenCount < 1)) {
    throw new BadRequestException('Farzandlar sonini kiriting');
  }
  if (out.childrenStatus === 'none') {
    out.childrenCount = 0;
  }

  out.updatedAt = new Date().toISOString();
  out.updatedBy = audit.userId;
  out.updatedByRole = audit.role;

  return out;
}
