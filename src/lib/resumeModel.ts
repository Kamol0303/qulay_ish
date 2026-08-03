import type { CertificateRecord, PortfolioItem, Profile } from '../types';
import { mediaUrl } from './mediaUrl';

export interface ResumeLanguage {
  name: string;
  level: number; // 0-100
}

export interface ResumeFileItem {
  id: string;
  title: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  kind: 'image' | 'video' | 'pdf' | 'document' | 'archive' | 'link' | 'other';
  sizeLabel?: string;
  issuer?: string;
  date?: string;
  source: 'certificate' | 'portfolio' | 'document' | 'photo' | 'cover';
}

export interface ResumeViewModel {
  fullName: string;
  title: string;
  summary: string;
  photoUrl?: string;
  initials: string;
  phone?: string;
  email?: string;
  telegram?: string;
  address: string;
  availability?: string;
  lookingForWork?: boolean;
  skills: string[];
  softSkills: string[];
  languages: ResumeLanguage[];
  interests: string[];
  experience: NonNullable<Profile['experience']>;
  education: NonNullable<Profile['education']>;
  certificates: CertificateRecord[];
  portfolio: PortfolioItem[];
  uploadedFiles: ResumeFileItem[];
  profileId: string;
  verifyUrl: string;
  isVerified: boolean;
  verificationDate?: string;
  templateId: string;
}

const SOFT_SKILL_HINTS = [
  'muloqot',
  'communication',
  'teamwork',
  'leadership',
  'time management',
  'problem solving',
  'creativity',
  'ijodkorlik',
  'javobgarlik',
  'punctual',
];

function detectKind(mimeType?: string, fileName?: string, url?: string): ResumeFileItem['kind'] {
  const mime = (mimeType || '').toLowerCase();
  const name = (fileName || url || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (/\.(zip|rar|7z)$/.test(name)) return 'archive';
  if (/^https?:\/\//.test(url || '') && /(github|behance|dribbble|http)/.test(url || '')) return 'link';
  if (mime.includes('document') || /\.(docx?|xlsx?|pptx?)$/.test(name)) return 'document';
  return 'other';
}

function parseLanguage(raw: string): ResumeLanguage {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.+?)[\s:=-]+(\d{1,3})\s*%?$/);
  if (match) {
    return { name: match[1].trim(), level: Math.min(100, Math.max(0, Number(match[2]))) };
  }
  const known: Record<string, number> = {
    uzbek: 100,
    "o'zbek": 100,
    ozbek: 100,
    russian: 70,
    rus: 70,
    english: 55,
    ingliz: 55,
  };
  const key = trimmed.toLowerCase();
  return { name: trimmed, level: known[key] ?? 65 };
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'QI';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

export function buildResumeModel(profile: Profile, origin = typeof window !== 'undefined' ? window.location.origin : ''): ResumeViewModel {
  const skills = profile.skills || [];
  const softSkills = skills.filter((s) =>
    SOFT_SKILL_HINTS.some((h) => s.toLowerCase().includes(h)),
  );
  const hardSkills = skills.filter((s) => !softSkills.includes(s));

  const certificates = (profile.certificates || []).map((c, i) => ({
    ...c,
    id: c.id || `cert-${i}`,
  }));

  const portfolio = (profile.portfolio || []).map((p, i) => ({
    ...p,
    id: p.id || `port-${i}`,
  }));

  const uploadedFiles: ResumeFileItem[] = [];

  if (profile.photoUrl) {
    uploadedFiles.push({
      id: 'photo',
      title: 'Profile Photo',
      fileUrl: profile.photoUrl,
      mimeType: 'image/*',
      kind: 'image',
      source: 'photo',
    });
  }

  for (const cert of certificates) {
    uploadedFiles.push({
      id: `cert-file-${cert.id}`,
      title: cert.title || cert.fileName || 'Certificate',
      fileUrl: cert.fileUrl,
      fileName: cert.fileName,
      mimeType: cert.mimeType,
      kind: detectKind(cert.mimeType, cert.fileName, cert.fileUrl),
      issuer: cert.issuer,
      date: cert.issuedAt,
      source: 'certificate',
    });
  }

  for (const item of portfolio) {
    uploadedFiles.push({
      id: `port-file-${item.id}`,
      title: item.title || item.fileName || 'Portfolio item',
      fileUrl: item.fileUrl,
      fileName: item.fileName,
      mimeType: item.mimeType,
      kind: detectKind(item.mimeType, item.fileName, item.fileUrl),
      date: item.createdAt,
      source: 'portfolio',
    });
  }

  const address = [profile.neighborhood, profile.district, profile.region].filter(Boolean).join(', ');

  return {
    fullName: profile.fullName || 'Foydalanuvchi',
    title:
      profile.experienceLevel ||
      (hardSkills[0] ? `${hardSkills[0]} mutaxassisi` : 'Professional') ||
      'Professional',
    summary: profile.professionalSummary || profile.bio || '',
    photoUrl: mediaUrl(profile.photoUrl),
    initials: initialsFrom(profile.fullName || 'QI'),
    phone: profile.phoneNumber,
    email: profile.email,
    telegram: profile.telegram,
    address,
    availability: profile.availability,
    lookingForWork: profile.lookingForWork,
    skills: hardSkills.length ? hardSkills : skills,
    softSkills,
    languages: (profile.languages || []).map(parseLanguage),
    interests: softSkills.slice(0, 6),
    experience: profile.experience || [],
    education: profile.education || [],
    certificates,
    portfolio,
    uploadedFiles,
    profileId: profile.uid,
    verifyUrl: `${origin}/worker/${profile.uid}`,
    isVerified: Boolean(profile.isVerified),
    verificationDate: profile.updatedAt
      ? new Date(profile.updatedAt).toLocaleDateString('uz-UZ')
      : undefined,
    templateId: String(profile.resumeTemplate || 'professional'),
  };
}

export function fileIconLabel(kind: ResumeFileItem['kind']): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'image':
      return 'IMG';
    case 'video':
      return 'VID';
    case 'archive':
      return 'ZIP';
    case 'document':
      return 'DOC';
    case 'link':
      return 'URL';
    default:
      return 'FILE';
  }
}
