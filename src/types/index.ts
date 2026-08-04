import type {
  AvailabilityStatus,
  PreferredContact,
  ResumeTemplateId,
  EducationRecord,
  ExperienceRecord,
  CertificateRecord,
  PortfolioItem,
  RecruiterContact,
  CompanyDocument,
} from './profile';
import type { WorkerPersonalInfo } from './personalInfo';

export type {
  AvailabilityStatus,
  PreferredContact,
  ResumeTemplateId,
  EducationRecord,
  ExperienceRecord,
  CertificateRecord,
  PortfolioItem,
  RecruiterContact,
  CompanyDocument,
  ProfileTab,
} from './profile';

export type {
  WorkerPersonalInfo,
  Gender,
  MaritalStatus,
  ChildrenStatus,
} from './personalInfo';

export {
  PERSONAL_INFO_REQUIRED,
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  CHILDREN_OPTIONS,
  calcAgeFromDob,
} from './personalInfo';

export interface Profile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  passwordHash?: string;
  role: 'worker' | 'employer' | 'admin' | 'super_admin';
  region: string;
  district?: string;
  neighborhood?: string;
  bio?: string;
  /** Confidential — only populated for worker self or super_admin */
  personalInfo?: WorkerPersonalInfo;
  skills?: string[];
  photoUrl?: string;
  coverUrl?: string;
  telegram?: string;
  languages?: string[];
  availability?: AvailabilityStatus | string;
  lookingForWork?: boolean;
  professionalSummary?: string;
  preferredContact?: PreferredContact | string;
  experienceLevel?: 'beginner' | 'intermediate' | 'expert' | string;
  isPremium?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastActive?: string | Date;
  isVerified?: boolean;
  verificationStatus?: 'none' | 'pending' | 'under_review' | 'verified' | 'rejected' | 'need_reupload';
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  education?: EducationRecord[];
  experience?: ExperienceRecord[];
  certificates?: CertificateRecord[];
  portfolio?: PortfolioItem[];
  resumeTemplate?: ResumeTemplateId | string;
  companyName?: string;
  businessType?: string;
  industry?: string;
  registrationNumber?: string;
  tin?: string;
  website?: string;
  foundedYear?: string;
  employeeCount?: string;
  officeAddress?: string;
  companyGallery?: PortfolioItem[];
  companyDocuments?: CompanyDocument[];
  recruiterContacts?: RecruiterContact[];
  violationCount?: number;
  riskScore?: number;
  lastViolation?: string | Date;
  isBlocked?: boolean;
  blockUntil?: string | Date;
  blockReason?: string;
  blockedAt?: string | Date;
  trustScore?: number;
  behaviorFlags?: string[];
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  employerId: string;
  employerName?: string;
  category?: string;
  region?: string;
  district?: string;
  neighborhood?: string;
  salary?: number;
  price?: number;
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'fixed';
  workType?: string;
  status?: 'active' | 'closed' | 'draft' | 'open';
  isPromoted?: boolean;
  requirements?: string[];
  images?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Application {
  id: string;
  jobId: string;
  workerId: string;
  employerId: string;
  workerName?: string;
  jobTitle?: string;
  message?: string;
  coverLetter?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt?: any;
  updatedAt?: any;
}

export interface Contract {
  id: string;
  jobId?: string;
  workerId: string;
  employerId: string;
  workerName?: string;
  employerName?: string;
  jobTitle?: string;
  salary?: number;
  amount?: number;
  startDate?: any;
  endDate?: any;
  status?: 'draft' | 'active' | 'completed' | 'cancelled' | 'disputed' | 'signed';
  terms?: string;
  signedByWorker?: boolean;
  signedByEmployer?: boolean;
  workerSigned?: boolean;
  employerSigned?: boolean;
  adminApproved?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Dispute {
  id: string;
  contractId: string;
  openedById: string;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  resolution?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'application' | 'contract' | 'message' | 'dispute' | 'system';
  read: boolean;
  link?: string;
  createdAt?: any;
}

export type VerificationRequestStatus =
  | 'none'
  | 'pending'
  | 'under_review'
  | 'verified'
  | 'rejected'
  | 'need_reupload'
  | 'approved'; // legacy alias

export interface PassportData {
  series: string;
  number: string;
  pinfl: string;
  fullName: string;
  issueDate: string;
  expiryDate: string;
}

export interface DocumentCheckResult {
  ok?: boolean;
  role?: string;
  mimeGuess?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  score?: number;
  checks?: Array<{ id: string; passed: boolean; detail: string }>;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  userName?: string;
  accountType?: 'worker' | 'employer' | string;
  documentType?: string;
  documentUrl?: string;
  idPhotoUrl?: string;
  selfieUrl?: string;
  addressProofUrl?: string;
  additionalFiles?: Array<{ url: string; title?: string }>;
  passportData?: PassportData | null;
  documentChecks?: DocumentCheckResult | Record<string, unknown> | null;
  status: VerificationRequestStatus;
  reviewedBy?: string;
  reviewNote?: string;
  adminNotes?: string;
  rejectionReason?: string;
  approvedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  user?: Partial<Profile>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content?: string;
  message?: string;
  text?: string;
  read?: boolean;
  delivered?: boolean;
  status?: 'sent' | 'delivered' | 'read';
  jobId?: string;
  contractId?: string;
  participants?: string[];
  createdAt?: any;
}

export interface ChatThread {
  peerId: string;
  peerName?: string;
  peerRole?: string;
  peerPhotoUrl?: string;
  lastMessage?: string;
  lastAt?: string | Date;
  unreadCount?: number;
}

export interface EmploymentStat {
  id: string;
  region: string;
  count: number;
  category?: string;
  month?: string;
  year?: number;
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  reviewerName?: string;
  rating: number;
  comment?: string;
  contractId?: string;
  createdAt?: any;
}

export interface ServicePost {
  id: string;
  workerId: string;
  workerName?: string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  expectedPrice?: number;
  priceType?: 'hourly' | 'daily' | 'fixed';
  region?: string;
  district?: string;
  images?: string[];
  isActive?: boolean;
  status?: 'active' | 'inactive' | 'pending';
  createdAt?: any;
  updatedAt?: any;
}
