import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { Job } from '../types';
import { demoStore } from '../lib/demoStore';
import rateLimitService from './rateLimitService';
import systemLogService from './systemLogService';

export interface JobCreationResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export const jobService = {
  /**
   * Create job with rate limit checking
   */
  async createWithRateLimit(
    jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>,
    maxPostsPerWeek: number = 5
  ): Promise<JobCreationResult> {
    try {
      // Check rate limit
      const limitCheck = await rateLimitService.checkJobPostLimit(jobData.employerId, maxPostsPerWeek);
      
      if (!limitCheck.allowed) {
        // Log the rate limit violation
        await rateLimitService.logRateLimitViolation(
          jobData.employerId,
          'JOB_POST',
          {
            currentCount: limitCheck.currentCount,
            limit: limitCheck.limit
          }
        );

        return {
          success: false,
          error: limitCheck.message || `Haftalik limit ${maxPostsPerWeek} ta e'londan oshib kaldi.`
        };
      }

      // If rate limit allows, create the job
      const docRef = await addDoc(collection(db, 'jobs'), {
        ...jobData,
        status: jobData.status || 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Log successful job creation
      await systemLogService.logAction(
        'POST_JOB',
        jobData.employerId,
        undefined,
        { jobId: docRef.id, title: jobData.title },
        'info'
      );

      // Mirror to localStorage
      demoStore.upsertJob({
        ...jobData,
        id: docRef.id,
        status: jobData.status || 'open',
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        jobId: docRef.id
      };
    } catch (error) {
      debugLogger.error('Error creating job with rate limit:', error);
      handleFirestoreError(error, OperationType.WRITE, 'jobs');
      return {
        success: false,
        error: 'Ish e\'loni yaratishda xatolik yuz berdi'
      };
    }
  },

  /**
   * Create job (legacy, without rate limiting)
   */
  async create(jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const docRef = await addDoc(collection(db, 'jobs'), {
        ...jobData,
        status: jobData.status || 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // Mirror to localStorage so all pages (including demo Super Admin) see it
      demoStore.upsertJob({
        ...jobData,
        id: docRef.id,
        status: jobData.status || 'open',
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      debugLogger.error('Error creating job:', error);
      handleFirestoreError(error, OperationType.WRITE, 'jobs');
      return null;
    }
  },

  async update(jobId: string, updates: Partial<Job>): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'jobs', jobId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      debugLogger.error('Error updating job:', error);
      handleFirestoreError(error, OperationType.UPDATE, `jobs/${jobId}`);
      return false;
    }
  },

  async delete(jobId: string): Promise<boolean> {
    try {
      // Soft delete by setting status to closed
      await updateDoc(doc(db, 'jobs', jobId), {
        status: 'closed',
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      debugLogger.error('Error deleting job:', error);
      handleFirestoreError(error, OperationType.UPDATE, `jobs/${jobId}`);
      return false;
    }
  },

  async getById(jobId: string): Promise<Job | null> {
    try {
      const docSnap = await getDoc(doc(db, 'jobs', jobId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Job;
      }
      return null;
    } catch (error) {
      debugLogger.error('Error fetching job:', error);
      handleFirestoreError(error, OperationType.GET, `jobs/${jobId}`);
      return null;
    }
  },

  async getByEmployer(employerId: string): Promise<Job[]> {
    try {
      const q = query(collection(db, 'jobs'), where('employerId', '==', employerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Job));
    } catch (error) {
      debugLogger.error('Error fetching employer jobs:', error);
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      return [];
    }
  },

  async updateStatus(jobId: string, status: Job['status']): Promise<boolean> {
    return this.update(jobId, { status });
  },

  async closeJob(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'closed');
  },

  async markAsFilled(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'filled');
  },

  async markAsInProgress(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'in-progress');
  },

  async markAsCompleted(jobId: string): Promise<boolean> {
    return this.updateStatus(jobId, 'completed');
  }
};
