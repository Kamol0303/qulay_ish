import { debugLogger } from '../../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { Job } from '../../types';

export interface SavedJob {
  id: string;
  userId: string;
  jobId: string;
  job?: Job;
  savedAt?: any;
}

/**
 * Saved Jobs Service - Manage bookmarked/favorite jobs
 */
export const savedJobsService = {
  /**
   * Save a job to user's favorites
   */
  async saveJob(userId: string, jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if already saved
      const q = query(
        collection(db, 'savedJobs'),
        where('userId', '==', userId),
        where('jobId', '==', jobId)
      );
      const existing = await getDocs(q);

      if (!existing.empty) {
        return {
          success: false,
          error: 'Bu ish allaqachon saqlangan'
        };
      }

      // Save the job
      await addDoc(collection(db, 'savedJobs'), {
        userId,
        jobId,
        savedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      debugLogger.error('Error saving job:', error);
      handleFirestoreError(error, OperationType.CREATE, 'savedJobs');
      return {
        success: false,
        error: 'Ish saqlanishda xatolik yuz berdi'
      };
    }
  },

  /**
   * Remove a job from user's favorites
   */
  async unsaveJob(userId: string, jobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const q = query(
        collection(db, 'savedJobs'),
        where('userId', '==', userId),
        where('jobId', '==', jobId)
      );
      const docs = await getDocs(q);

      if (docs.empty) {
        return {
          success: false,
          error: 'Ish topilmadi'
        };
      }

      // Delete each matching document
      for (const doc of docs.docs) {
        await deleteDoc(doc.ref);
      }

      return { success: true };
    } catch (error) {
      debugLogger.error('Error unsaving job:', error);
      handleFirestoreError(error, OperationType.DELETE, 'savedJobs');
      return {
        success: false,
        error: 'Ish o\'chirilishda xatolik yuz berdi'
      };
    }
  },

  /**
   * Get all saved jobs for a user
   */
  async getSavedJobs(userId: string): Promise<SavedJob[]> {
    try {
      const q = query(
        collection(db, 'savedJobs'),
        where('userId', '==', userId)
      );
      const docs = await getDocs(q);

      const savedJobs: SavedJob[] = [];

      for (const doc of docs.docs) {
        const data = doc.data();
        
        // Fetch the actual job details
        try {
          const jobDoc = await getDoc(doc(db, 'jobs', data.jobId));
          if (jobDoc.exists()) {
            savedJobs.push({
              id: doc.id,
              userId: data.userId,
              jobId: data.jobId,
              job: { id: jobDoc.id, ...jobDoc.data() } as Job,
              savedAt: data.savedAt
            });
          }
        } catch (err) {
          debugLogger.warn('Could not fetch job details for saved job:', data.jobId);
        }
      }

      return savedJobs;
    } catch (error) {
      debugLogger.error('Error fetching saved jobs:', error);
      handleFirestoreError(error, OperationType.LIST, 'savedJobs');
      return [];
    }
  },

  /**
   * Check if a job is saved by user
   */
  async isJobSaved(userId: string, jobId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'savedJobs'),
        where('userId', '==', userId),
        where('jobId', '==', jobId)
      );
      const docs = await getDocs(q);
      return !docs.empty;
    } catch (error) {
      debugLogger.error('Error checking if job is saved:', error);
      return false;
    }
  },

  /**
   * Get count of saved jobs for user
   */
  async getSavedJobsCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'savedJobs'),
        where('userId', '==', userId)
      );
      const docs = await getDocs(q);
      return docs.size;
    } catch (error) {
      debugLogger.error('Error counting saved jobs:', error);
      return 0;
    }
  },

  /**
   * Get most saved jobs (popular jobs)
   */
  async getPopularSavedJobs(limit: number = 10): Promise<{ jobId: string; saveCount: number }[]> {
    try {
      const q = query(collection(db, 'savedJobs'));
      const docs = await getDocs(q);

      // Count saves per job
      const saveCounts: Record<string, number> = {};

      docs.forEach(doc => {
        const data = doc.data();
        saveCounts[data.jobId] = (saveCounts[data.jobId] || 0) + 1;
      });

      // Sort by count and return top N
      return Object.entries(saveCounts)
        .map(([jobId, count]) => ({ jobId, saveCount: count }))
        .sort((a, b) => b.saveCount - a.saveCount)
        .slice(0, limit);
    } catch (error) {
      debugLogger.error('Error getting popular jobs:', error);
      return [];
    }
  }
};
