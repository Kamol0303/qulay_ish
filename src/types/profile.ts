export type AvailabilityStatus = 'available' | 'busy' | 'offline';
export type PreferredContact = 'phone' | 'email' | 'telegram';
export type ResumeTemplateId = 'minimal' | 'professional' | 'corporate' | 'government' | 'modern' | 'creative';

export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  startYear?: string;
  endYear?: string;
  notes?: string;
}

export interface ExperienceRecord {
  id: string;
  company: string;
  position: string;
  startYear?: string;
  endYear?: string;
  current?: boolean;
  details?: string;
  achievements?: string;
}

export interface CertificateRecord {
  id: string;
  title: string;
  issuer?: string;
  issuedAt?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  kind: 'image' | 'video' | 'document';
  createdAt?: string;
}

export interface RecruiterContact {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  telegram?: string;
}

export interface CompanyDocument {
  id: string;
  title: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
}

export type ProfileTab =
  | 'overview'
  | 'experience'
  | 'education'
  | 'skills'
  | 'portfolio'
  | 'certificates'
  | 'resume'
  | 'company'
  | 'jobs'
  | 'settings';
