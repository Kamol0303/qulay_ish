import { PrismaClient, UserRole, VerificationStatus, JobStatus, ApplicationStatus, ContractStatus, DisputeStatus, NotificationType, ServicePostStatus, PaymentStatus, LogType } from '@prisma/client';
import {
  readExportFile,
  readSingleDocExport,
  toDate,
  toDateOrNow,
  normalizeRegion,
  asString,
  asNumber,
  asBool,
  asStringArray,
  mapEnum,
} from './transform';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const IMPORT_DIRS = [
  path.resolve(__dirname, '../../data/import'),
  path.resolve(__dirname, '../../data/firestore-export'),
];

let cachedImportDir: string | null = null;

function getImportDir(): string {
  if (cachedImportDir) return cachedImportDir;
  for (const dir of IMPORT_DIRS) {
    if (fs.existsSync(path.join(dir, 'profiles.json'))) {
      cachedImportDir = dir;
      return dir;
    }
  }
  cachedImportDir = IMPORT_DIRS[0];
  return cachedImportDir;
}

const userRoles = ['worker', 'employer', 'admin', 'super_admin'] as const;
const verificationStatuses = ['none', 'pending', 'verified', 'rejected'] as const;
const jobStatuses = ['active', 'closed', 'draft', 'open'] as const;
const applicationStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
const contractStatuses = ['draft', 'active', 'completed', 'cancelled', 'disputed', 'signed'] as const;
const disputeStatuses = ['pending', 'resolved', 'rejected'] as const;
const notificationTypes = ['application', 'contract', 'message', 'dispute', 'system'] as const;
const servicePostStatuses = ['active', 'inactive', 'pending'] as const;
const paymentStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'] as const;
const logTypes = ['info', 'warning', 'error'] as const;

const existingUserIds = new Set<string>();
const existingJobIds = new Set<string>();
const existingContractIds = new Set<string>();

function sanitizePhone(value: unknown): string | null {
  const phone = asString(value).trim();
  return phone || null;
}

async function loadUsedPhones(): Promise<Map<string, string>> {
  const rows = await prisma.user.findMany({
    where: { phoneNumber: { not: null } },
    select: { id: true, phoneNumber: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.phoneNumber) map.set(row.phoneNumber, row.id);
  }
  return map;
}

function claimPhone(
  phonesByNumber: Map<string, string>,
  userId: string,
  rawPhone: unknown,
): string | null {
  const phone = sanitizePhone(rawPhone);
  if (!phone) return null;

  const owner = phonesByNumber.get(phone);
  if (owner && owner !== userId) {
    console.warn(`[seed] duplicate phone ${phone} for user ${userId} (owned by ${owner}), storing without phone`);
    return null;
  }

  phonesByNumber.set(phone, userId);
  return phone;
}

async function seedUsers() {
  const profiles = readExportFile(getImportDir(), 'profiles');
  let authUsers: Array<Record<string, unknown>> = [];
  const authPath = path.join(getImportDir(), 'auth_users.json');
  if (fs.existsSync(authPath)) {
    authUsers = (JSON.parse(fs.readFileSync(authPath, 'utf8')) as { users: Array<Record<string, unknown>> }).users;
  }

  const authByUid = new Map(authUsers.map((u) => [asString(u.uid), u]));
  const phonesByNumber = await loadUsedPhones();

  for (const doc of profiles) {
    const d = doc.data;
    const id = doc.id || asString(d.uid);
    if (!id) continue;

    const auth = authByUid.get(id);
    const phoneNumber = claimPhone(
      phonesByNumber,
      id,
      asString(d.phoneNumber) || asString(auth?.phoneNumber),
    );

    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email: asString(d.email) || asString(auth?.email) || null,
        phoneNumber,
        passwordHash: asString(d.passwordHash) || null,
        fullName: asString(d.fullName, 'User'),
        role: mapEnum(d.role, userRoles, UserRole.worker),
        region: normalizeRegion(d.region),
        district: asString(d.district) || null,
        neighborhood: asString(d.neighborhood) || null,
        bio: asString(d.bio) || null,
        skills: asStringArray(d.skills),
        photoUrl: asString(d.photoUrl) || null,
        experienceLevel: asString(d.experienceLevel) || null,
        isPremium: asBool(d.isPremium),
        isVerified: asBool(d.isVerified),
        verificationStatus: mapEnum(d.verificationStatus, verificationStatuses, VerificationStatus.none),
        rating: asNumber(d.rating) ?? 0,
        reviewCount: asNumber(d.reviewCount) ?? 0,
        completedJobs: asNumber(d.completedJobs) ?? 0,
        education: d.education as object | undefined,
        experience: d.experience as object | undefined,
        violationCount: asNumber(d.violationCount) ?? 0,
        riskScore: asNumber(d.riskScore) ?? 0,
        lastViolation: toDate(d.lastViolation),
        isBlocked: asBool(d.isBlocked),
        blockUntil: toDate(d.blockUntil),
        blockReason: asString(d.blockReason) || null,
        blockedAt: toDate(d.blockedAt),
        trustScore: asNumber(d.trustScore) ?? 100,
        behaviorFlags: asStringArray(d.behaviorFlags),
        createdAt: toDateOrNow(d.createdAt ?? auth?.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
        lastActive: toDate(d.lastActive ?? auth?.lastSignIn),
      },
      update: {},
    });
    existingUserIds.add(id);
  }

  // Auth users without profile
  for (const auth of authUsers) {
    const id = asString(auth.uid);
    if (!id || existingUserIds.has(id)) continue;
    const phoneNumber = claimPhone(phonesByNumber, id, auth.phoneNumber);
    await prisma.user.create({
      data: {
        id,
        email: asString(auth.email) || null,
        phoneNumber,
        fullName: asString(auth.displayName, 'User'),
        role: UserRole.worker,
        region: '',
        createdAt: toDateOrNow(auth.createdAt),
        updatedAt: toDateOrNow(auth.createdAt),
        lastActive: toDate(auth.lastSignIn),
      },
    });
    existingUserIds.add(id);
  }

  console.log(`[seed] users: ${existingUserIds.size}`);
}

async function seedJobs() {
  const docs = readExportFile(getImportDir(), 'jobs');
  for (const doc of docs) {
    const d = doc.data;
    if (!existingUserIds.has(asString(d.employerId))) continue;
    await prisma.job.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        title: asString(d.title, 'Untitled'),
        description: asString(d.description) || null,
        employerId: asString(d.employerId),
        employerName: asString(d.employerName) || null,
        category: asString(d.category) || null,
        region: normalizeRegion(d.region) || null,
        district: asString(d.district) || null,
        neighborhood: asString(d.neighborhood) || null,
        salary: asNumber(d.salary),
        price: asNumber(d.price),
        salaryType: asString(d.salaryType) || null,
        workType: asString(d.workType) || null,
        status: mapEnum(d.status, jobStatuses, JobStatus.active),
        isPromoted: asBool(d.isPromoted),
        requirements: asStringArray(d.requirements),
        images: asStringArray(d.images),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
    existingJobIds.add(doc.id);
  }
  console.log(`[seed] jobs: ${existingJobIds.size}`);
}

async function seedServicePosts() {
  const docs = readExportFile(getImportDir(), 'service_posts');
  for (const doc of docs) {
    const d = doc.data;
    if (!existingUserIds.has(asString(d.workerId))) continue;
    await prisma.servicePost.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        workerId: asString(d.workerId),
        workerName: asString(d.workerName) || null,
        title: asString(d.title, 'Service'),
        description: asString(d.description) || null,
        category: asString(d.category) || null,
        price: asNumber(d.price),
        expectedPrice: asNumber(d.expectedPrice),
        priceType: asString(d.priceType) || null,
        region: normalizeRegion(d.region) || null,
        district: asString(d.district) || null,
        images: asStringArray(d.images),
        isActive: asBool(d.isActive, true),
        status: mapEnum(d.status, servicePostStatuses, ServicePostStatus.active),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedApplications() {
  const docs = readExportFile(getImportDir(), 'applications');
  let count = 0;
  for (const doc of docs) {
    const d = doc.data;
    const jobId = asString(d.jobId);
    const workerId = asString(d.workerId);
    const employerId = asString(d.employerId);
    if (!existingJobIds.has(jobId) || !existingUserIds.has(workerId) || !existingUserIds.has(employerId)) continue;
    await prisma.application.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        jobId,
        workerId,
        employerId,
        workerName: asString(d.workerName) || null,
        jobTitle: asString(d.jobTitle) || null,
        message: asString(d.message) || null,
        coverLetter: asString(d.coverLetter) || null,
        status: mapEnum(d.status, applicationStatuses, ApplicationStatus.pending),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
    count++;
  }
  console.log(`[seed] applications: ${count}`);
}

async function seedContracts() {
  const docs = readExportFile(getImportDir(), 'contracts');
  for (const doc of docs) {
    const d = doc.data;
    const workerId = asString(d.workerId);
    const employerId = asString(d.employerId);
    const jobId = asString(d.jobId) || null;
    if (!existingUserIds.has(workerId) || !existingUserIds.has(employerId)) continue;
    if (jobId && !existingJobIds.has(jobId)) continue;
    await prisma.contract.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        jobId,
        workerId,
        employerId,
        workerName: asString(d.workerName) || null,
        employerName: asString(d.employerName) || null,
        jobTitle: asString(d.jobTitle) || null,
        salary: asNumber(d.salary),
        amount: asNumber(d.amount),
        startDate: toDate(d.startDate),
        endDate: toDate(d.endDate),
        status: mapEnum(d.status, contractStatuses, ContractStatus.draft),
        terms: asString(d.terms) || null,
        signedByWorker: asBool(d.signedByWorker) || asBool(d.workerSigned),
        signedByEmployer: asBool(d.signedByEmployer) || asBool(d.employerSigned),
        adminApproved: asBool(d.adminApproved),
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
    existingContractIds.add(doc.id);
  }
  console.log(`[seed] contracts: ${existingContractIds.size}`);
}

async function seedDisputes() {
  const docs = readExportFile(getImportDir(), 'disputes');
  for (const doc of docs) {
    const d = doc.data;
    const contractId = asString(d.contractId);
    const openedById = asString(d.openedById);
    if (!existingContractIds.has(contractId) || !existingUserIds.has(openedById)) continue;
    await prisma.dispute.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        contractId,
        openedById,
        reason: asString(d.reason, 'No reason'),
        status: mapEnum(d.status, disputeStatuses, DisputeStatus.pending),
        resolution: asString(d.resolution) || null,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedVerificationRequests() {
  const docs = readExportFile(getImportDir(), 'verification_requests');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId);
    if (!existingUserIds.has(userId)) continue;
    await prisma.verificationRequest.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        userName: asString(d.userName) || null,
        documentType: asString(d.documentType) || null,
        documentUrl: asString(d.documentUrl) || null,
        idPhotoUrl: asString(d.idPhotoUrl) || null,
        selfieUrl: asString(d.selfieUrl) || null,
        status: mapEnum(d.status, verificationStatuses, VerificationStatus.pending),
        reviewedBy: asString(d.reviewedBy) || null,
        reviewNote: asString(d.reviewNote) || null,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedReviews() {
  const docs = readExportFile(getImportDir(), 'reviews');
  for (const doc of docs) {
    const d = doc.data;
    const reviewerId = asString(d.reviewerId);
    const revieweeId = asString(d.revieweeId) || asString(d.workerId);
    if (!existingUserIds.has(reviewerId) || !existingUserIds.has(revieweeId)) continue;
    await prisma.review.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        reviewerId,
        revieweeId,
        reviewerName: asString(d.reviewerName) || null,
        rating: asNumber(d.rating) ?? 5,
        comment: asString(d.comment) || null,
        contractId: asString(d.contractId) || null,
        createdAt: toDateOrNow(d.createdAt),
      },
      update: {},
    });
  }
}

async function seedSavedJobs() {
  const docs = readExportFile(getImportDir(), 'savedJobs');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId);
    const jobId = asString(d.jobId);
    if (!existingUserIds.has(userId) || !existingJobIds.has(jobId)) continue;
    await prisma.savedJob.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        jobId,
        createdAt: toDateOrNow(d.createdAt),
      },
      update: {},
    });
  }
}

async function seedNotifications() {
  const docs = readExportFile(getImportDir(), 'notifications');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId);
    if (!existingUserIds.has(userId)) continue;
    await prisma.notification.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        title: asString(d.title, 'Notification'),
        message: asString(d.message, ''),
        type: mapEnum(d.type, notificationTypes, NotificationType.system),
        read: asBool(d.read),
        link: asString(d.link) || null,
        createdAt: toDateOrNow(d.createdAt),
      },
      update: {},
    });
  }
}

async function seedChatMessages() {
  const docs = readExportFile(getImportDir(), 'chat_messages');
  for (const doc of docs) {
    const d = doc.data;
    const senderId = asString(d.senderId);
    const receiverId = asString(d.receiverId);
    if (!existingUserIds.has(senderId) || !existingUserIds.has(receiverId)) continue;
    const content = asString(d.message) || asString(d.text) || '';
    if (!content) continue;
    await prisma.chatMessage.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        senderId,
        receiverId,
        content,
        read: asBool(d.read),
        delivered: asBool(d.delivered),
        status: asString(d.status) || null,
        jobId: asString(d.jobId) || null,
        contractId: asString(d.contractId) || null,
        createdAt: toDateOrNow(d.createdAt),
      },
      update: {},
    });
  }
}

async function seedPayments() {
  const docs = readExportFile(getImportDir(), 'payments');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId);
    if (!existingUserIds.has(userId)) continue;
    await prisma.payment.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        amount: asNumber(d.amount) ?? 0,
        currency: asString(d.currency, 'UZS'),
        type: asString(d.type, 'premium_upgrade'),
        provider: asString(d.provider, 'payme'),
        status: mapEnum(d.status, paymentStatuses, PaymentStatus.pending),
        transactionId: asString(d.transactionId) || null,
        metadata: (d.metadata as object) ?? undefined,
        createdAt: toDateOrNow(d.createdAt),
        updatedAt: toDateOrNow(d.updatedAt ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedViolations() {
  const docs = readExportFile(getImportDir(), 'violations');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId);
    if (!existingUserIds.has(userId)) continue;
    await prisma.violation.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        violationType: asString(d.violationType, 'unknown'),
        message: asString(d.message) || null,
        action: asString(d.action) || null,
        createdAt: toDateOrNow(d.timestamp ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedActivityLogs() {
  const docs = readExportFile(getImportDir(), 'activity_logs');
  for (const doc of docs) {
    const d = doc.data;
    const userId = asString(d.userId) || null;
    if (userId && !existingUserIds.has(userId)) continue;
    await prisma.activityLog.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        userId,
        action: asString(d.action, 'activity'),
        details: (d.details as object) ?? undefined,
        createdAt: toDateOrNow(d.createdAt ?? d.timestamp),
      },
      update: {},
    });
  }
}

async function seedSystemLogs() {
  const docs = readExportFile(getImportDir(), 'system_logs');
  for (const doc of docs) {
    const d = doc.data;
    await prisma.systemLog.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        action: asString(d.action, 'log'),
        userId: asString(d.userId) || null,
        userEmail: asString(d.userEmail) || null,
        details: (d.details as object) ?? undefined,
        type: mapEnum(d.type, logTypes, LogType.info),
        createdAt: toDateOrNow(d.timestamp ?? d.createdAt),
      },
      update: {},
    });
  }
}

async function seedSettings() {
  const data = readSingleDocExport(getImportDir(), 'settings', 'global_config');
  if (!data) return;
  await prisma.globalSettings.upsert({
    where: { id: 'global_config' },
    create: {
      id: 'global_config',
      maxJobPostsPerWeek: asNumber(data.maxJobPostsPerWeek) ?? 5,
      maxServicePostsPerWeek: asNumber(data.maxServicePostsPerWeek) ?? 5,
      maxApplicationsPerDay: asNumber(data.maxApplicationsPerDay) ?? 10,
      enableNotifications: asBool(data.enableNotifications, true),
      enableModeration: asBool(data.enableModeration, true),
      maintenanceMode: asBool(data.maintenanceMode),
      updatedBy: asString(data.updatedBy) || null,
    },
    update: {},
  });
}

async function seedSystemStats() {
  const data = readSingleDocExport(getImportDir(), 'system_stats', 'revenue');
  if (!data) return;
  await prisma.systemStats.upsert({
    where: { id: 'revenue' },
    create: {
      id: 'revenue',
      total: asNumber(data.total) ?? 0,
      monthly: (data.monthly as object) ?? undefined,
    },
    update: {},
  });
}

async function main() {
  const importDir = getImportDir();
  if (!fs.existsSync(importDir) || !fs.existsSync(path.join(importDir, 'profiles.json'))) {
    console.warn('[seed] No import data in data/import/ or data/firestore-export/.');
    console.warn('[seed] Creating empty global settings only.');
    await prisma.globalSettings.upsert({
      where: { id: 'global_config' },
      create: { id: 'global_config' },
      update: {},
    });
    return;
  }

  await seedUsers();
  await seedSettings();
  await seedSystemStats();
  await seedJobs();
  await seedServicePosts();
  await seedApplications();
  await seedContracts();
  await seedDisputes();
  await seedVerificationRequests();
  await seedReviews();
  await seedSavedJobs();
  await seedNotifications();
  await seedChatMessages();
  await seedPayments();
  await seedViolations();
  await seedActivityLogs();
  await seedSystemLogs();

  console.log('[seed] Import complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
