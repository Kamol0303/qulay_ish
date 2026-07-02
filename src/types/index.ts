export interface Profile {
  uid: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  passwordHash?: string; // Hashed password for authentication
  role: 'worker' | 'employer' | 'admin' | 'super_admin';
  region: string;
  district?: string;
  neighborhood?: string;
  bio?: string;
  skills?: string[];
  photoUrl?: string;
  experienceLevel?: 'beginner' | 'intermediate' | 'expert' | string;
  isPremium?: boolean;
  createdAt?: any;
  updatedAt?: any;
  lastActive?: any;
  isVerified?: boolean;
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected';
  rating?: number;
  reviewCount?: number;
  completedJobs?: number;
  education?: Array<{ institution: string; degree: string; startYear?: string; endYear?: string; notes?: string }>;
  experience?: Array<{ company: string; position: string; startYear?: string; endYear?: string; details?: string }>;
  // New moderation fields
  violationCount?: number;
  riskScore?: number;
  lastViolation?: any;
  isBlocked?: boolean;
  blockUntil?: any;
  blockReason?: string;
  blockedAt?: any;
  // Behavior tracking
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

export interface VerificationRequest {
  id: string;
  userId: string;
  userName?: string;
  documentType?: string;
  documentUrl?: string;
  idPhotoUrl?: string;
  selfieUrl?: string;
  status: 'pending' | 'verified' | 'rejected' | 'approved';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
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
