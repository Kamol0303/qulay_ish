import { debugLogger } from '../lib/debugLogger';
import { Job } from '../types';
import { demoStore } from '../lib/demoStore';
import rateLimitService from './rateLimitService';
import systemLogService from './systemLogService';
import { api } from '../lib/api';

export interface JobCreationResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export const jobService = {
  async createWithRateLimit(
    jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>,
    maxPostsPerWeek: number = 5
  ): Promise<JobCreationResult> {
    try {
      const limitCheck = await rateLimitService.checkJobPostLimit(jobData.employerId, maxPostsPerWeek);
      if (!limitCheck.allowed) {
        await rateLimitService.logRateLimitViolation(jobData.employerId, 'JOB_POST', {
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
        });
        return {
          success: false,
          error: limitCheck.message || `Haftalik limit ${maxPostsPerWeek} ta e'londan oshib kaldi.`,
        };
      }

      const created = await api.jobs.create({
        ...jobData,
        status: jobData.status || 'open',
      });

      await systemLogService.logAction('POST_JOB', jobData.employerId, undefined, { jobId: created.id, title: jobData.title }, 'info');

      demoStore.upsertJob({
        ...jobData,
        id: created.id,
        status: jobData.status || 'open',
        createdAt: new Date().toISOString(),
      });

      return { success: true, jobId: created.id };
    } catch (error) {
      debugLogger.error('Error creating job with rate limit:', error);
      return { success: false, error: "Ish e'loni yaratishda xatolik yuz berdi" };
    }
  },

  async create(jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const created = await api.jobs.create({ ...jobData, status: jobData.status || 'open' });
      demoStore.upsertJob({
        ...jobData,
        id: created.id,
        status: jobData.status || 'open',
        createdAt: new Date().toISOString(),
      });
      return created.id;
    } catch (error) {
      debugLogger.error('Error creating job:', error);
      return null;
    }
  },

  async update(jobId: string, updates: Partial<Job>): Promise<boolean> {
    try {
      await api.jobs.update(jobId, updates);
      return true;
    } catch (error) {
      debugLogger.error('Error updating job:', error);
      return false;
    }
  },

  async delete(jobId: string): Promise<boolean> {
    return this.update(jobId, { status: 'closed' });
  },

  async getById(jobId: string): Promise<Job | null> {
    try {
      return await api.jobs.get(jobId);
    } catch (error) {
      debugLogger.error('Error fetching job:', error);
      return null;
    }
  },

  async getByEmployer(employerId: string): Promise<Job[]> {
    try {
      return await api.jobs.list({ employerId });
    } catch (error) {
      debugLogger.error('Error fetching employer jobs:', error);
      return [];
    }
  },

  async list(params?: Record<string, string>): Promise<Job[]> {
    return api.jobs.list(params);
  },

  async updateStatus(jobId: string, status: Job['status']): Promise<boolean> {
    return this.update(jobId, { status });
  },

  async closeJob(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'closed');
  },

  async markAsFilled(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'closed');
  },

  async markAsInProgress(jobId: string): Promise<boolean> {
    return this.update(jobId, { status: 'active' });
  },

  async markAsCompleted(jobId: string): Promise<boolean> {
    return this.update(jobId, { status: 'closed' });
  },
};
