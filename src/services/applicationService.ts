import { debugLogger } from '../lib/debugLogger';
import { Application, Profile, Job } from '../types';
import { notificationService } from './notificationService';
import rateLimitService from './rateLimitService';
import systemLogService from './systemLogService';
import { api } from '../lib/api';

export interface ApplicationCreationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

export const applicationService = {
  async createWithRateLimit(
    applicationData: {
      jobId: string;
      workerId: string;
      employerId: string;
      message: string;
      coverLetter?: string;
      expectedSalary?: string;
      workerName?: string;
      workerEmail?: string;
      workerPhone?: string;
      jobTitle?: string;
    },
    maxAppsPerDay: number = 10
  ): Promise<ApplicationCreationResult> {
    try {
      const limitCheck = await rateLimitService.checkApplicationLimit(applicationData.workerId, maxAppsPerDay);
      if (!limitCheck.allowed) {
        await rateLimitService.logRateLimitViolation(applicationData.workerId, 'APPLICATION', {
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          jobId: applicationData.jobId,
        });
        return { success: false, error: limitCheck.message || `Kunlik limit ${maxAppsPerDay} ta ishtiromidan oshib kaldi.` };
      }

      const existing = await api.applications.list({
        jobId: applicationData.jobId,
        workerId: applicationData.workerId,
      });
      if (existing.length > 0) {
        return { success: false, error: 'Siz allaqachon bu ishga ishtiromi qilgansiz' };
      }

      const created = await api.applications.create({
        ...applicationData,
        status: 'pending',
      });

      await systemLogService.logAction('APPLY_JOB', applicationData.workerId, applicationData.workerEmail, {
        jobId: applicationData.jobId,
        applicationId: created.id,
      }, 'info');

      const worker = await api.users.get(applicationData.workerId).catch(() => null);
      const job = await api.jobs.get(applicationData.jobId).catch(() => null);
      if (worker && job) {
        await notificationService.notifyNewApplication(
          applicationData.employerId,
          worker.fullName,
          job.title,
          created.id
        );
      }

      return { success: true, applicationId: created.id };
    } catch (error) {
      debugLogger.error('Error creating application with rate limit:', error);
      return { success: false, error: 'Ishtiromi yaratishda xatolik yuz berdi' };
    }
  },

  async create(applicationData: {
    jobId: string;
    workerId: string;
    employerId: string;
    message: string;
    coverLetter?: string;
    workerName?: string;
    workerEmail?: string;
    jobTitle?: string;
  }): Promise<string | null> {
    const result = await this.createWithRateLimit(applicationData);
    return result.success ? result.applicationId ?? null : null;
  },

  async update(applicationId: string, updates: Partial<Application>): Promise<boolean> {
    try {
      await api.applications.update(applicationId, updates);
      return true;
    } catch (error) {
      debugLogger.error('Error updating application:', error);
      return false;
    }
  },

  async updateStatus(applicationId: string, status: Application['status']): Promise<boolean> {
    return this.update(applicationId, { status });
  },

  async getById(applicationId: string): Promise<Application | null> {
    try {
      return await api.applications.get(applicationId);
    } catch {
      return null;
    }
  },

  async getByJob(jobId: string): Promise<Application[]> {
    return api.applications.list({ jobId });
  },

  async getByWorker(workerId: string): Promise<Application[]> {
    return api.applications.list({ workerId });
  },

  async getByEmployer(employerId: string): Promise<Application[]> {
    return api.applications.list({ employerId });
  },

  async approve(applicationId: string): Promise<boolean> {
    return this.update(applicationId, { status: 'accepted' });
  },

  async reject(applicationId: string): Promise<boolean> {
    return this.update(applicationId, { status: 'rejected' });
  },
};
