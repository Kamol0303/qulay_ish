import { debugLogger } from '../../lib/debugLogger';
import { Job } from '../../types';
import { api } from '../../lib/api';

export interface SavedJob {
  id: string;
  userId: string;
  jobId: string;
  job?: Job;
  savedAt?: string;
}

export const savedJobsService = {
  async saveJob(userId: string, jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const existing = await api.savedJobs.list(userId);
      if (existing.some((s) => s.jobId === jobId)) {
        return { success: false, error: 'Bu ish allaqachon saqlangan' };
      }
      await api.savedJobs.create(userId, jobId);
      return { success: true };
    } catch (error) {
      debugLogger.error('Error saving job:', error);
      return { success: false, error: 'Ish saqlanishda xatolik yuz berdi' };
    }
  },

  async unsaveJob(userId: string, jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await api.savedJobs.remove(userId, jobId);
      return { success: true };
    } catch (error) {
      debugLogger.error('Error unsaving job:', error);
      return { success: false, error: "Ish o'chirishda xatolik" };
    }
  },

  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    const list = await api.savedJobs.list(userId);
    return list.some((s) => s.jobId === jobId);
  },

  async getSavedJobs(userId: string): Promise<SavedJob[]> {
    const list = await api.savedJobs.list(userId);
    return list.map((item) => ({
      id: item.id,
      userId: item.userId,
      jobId: item.jobId,
      job: item.job,
      savedAt: (item as { createdAt?: string }).createdAt,
    }));
  },
};
