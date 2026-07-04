import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Application, Profile, Job } from '../types';
import { notificationService } from './notificationService';
import rateLimitService from './rateLimitService';
import systemLogService from './systemLogService';

export interface ApplicationCreationResult {
  success: boolean;
  applicationId?: string;
  error?: string;
}

export const applicationService = {
  /**
   * Create application with rate limit checking
   */
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
      // Check rate limit
      const limitCheck = await rateLimitService.checkApplicationLimit(applicationData.workerId, maxAppsPerDay);
      
      if (!limitCheck.allowed) {
        // Log the rate limit violation
        await rateLimitService.logRateLimitViolation(
          applicationData.workerId,
          'APPLICATION',
          {
            currentCount: limitCheck.currentCount,
            limit: limitCheck.limit,
            jobId: applicationData.jobId
          }
        );

        return {
          success: false,
          error: limitCheck.message || `Kunlik limit ${maxAppsPerDay} ta ishtiromidan oshib kaldi.`
        };
      }

      // Check for duplicate application
      const q = query(
        collection(db, 'applications'),
        where('jobId', '==', applicationData.jobId),
        where('workerId', '==', applicationData.workerId)
      );
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        return {
          success: false,
          error: 'Siz allaqachon bu ishga ishtiromi qilgansiz'
        };
      }

      // Create application
      const docRef = await addDoc(collection(db, 'applications'), {
        ...applicationData,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Log successful application
      await systemLogService.logAction(
        'APPLY_JOB',
        applicationData.workerId,
        applicationData.workerEmail,
        { jobId: applicationData.jobId, applicationId: docRef.id },
        'info'
      );

      // Fetch worker and job details for notification
      const workerSnap = await getDoc(doc(db, 'profiles', applicationData.workerId));
      const jobSnap = await getDoc(doc(db, 'jobs', applicationData.jobId));
      
      if (workerSnap.exists() && jobSnap.exists()) {
        const worker = workerSnap.data() as Profile;
        const job = jobSnap.data() as Job;
        
        // Notify employer
        await notificationService.notifyNewApplication(
          applicationData.employerId,
          worker.fullName,
          job.title,
          docRef.id
        );
      }

      return {
        success: true,
        applicationId: docRef.id
      };
    } catch (error) {
      debugLogger.error('Error creating application with rate limit:', error);
      return {
        success: false,
        error: 'Ishtiromi yaratishda xatolik yuz berdi'
      };
    }
  },

  /**
   * Create application (legacy, without rate limiting)
   */
  async create(applicationData: {
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
  }): Promise<string | null> {
    try {
      // Check for duplicate application
      const q = query(
        collection(db, 'applications'),
        where('jobId', '==', applicationData.jobId),
        where('workerId', '==', applicationData.workerId)
      );
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        throw new Error('Already applied to this job');
      }

      // Create application
      const docRef = await addDoc(collection(db, 'applications'), {
        ...applicationData,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Fetch worker and job details for notification
      const workerSnap = await getDoc(doc(db, 'profiles', applicationData.workerId));
      const jobSnap = await getDoc(doc(db, 'jobs', applicationData.jobId));
      
      if (workerSnap.exists() && jobSnap.exists()) {
        const worker = workerSnap.data() as Profile;
        const job = jobSnap.data() as Job;
        
        // Notify employer
        await notificationService.notifyNewApplication(
          applicationData.employerId,
          worker.fullName,
          job.title,
          docRef.id
        );
      }

      return docRef.id;
    } catch (error) {
      debugLogger.error('Error creating application:', error);
      handleFirestoreError(error, OperationType.WRITE, 'applications');
      return null;
    }
  },

  async update(applicationId: string, updates: Partial<Application>): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'applications', applicationId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      debugLogger.error('Error updating application:', error);
      handleFirestoreError(error, OperationType.UPDATE, `applications/${applicationId}`);
      return false;
    }
  },

  async getById(applicationId: string): Promise<Application | null> {
    try {
      const docSnap = await getDoc(doc(db, 'applications', applicationId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Application;
      }
      return null;
    } catch (error) {
      debugLogger.error('Error fetching application:', error);
      handleFirestoreError(error, OperationType.GET, `applications/${applicationId}`);
      return null;
    }
  },

  async getByJob(jobId: string): Promise<Application[]> {
    try {
      const q = query(collection(db, 'applications'), where('jobId', '==', jobId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
    } catch (error) {
      debugLogger.error('Error fetching job applications:', error);
      handleFirestoreError(error, OperationType.LIST, 'applications');
      return [];
    }
  },

  async getByWorker(workerId: string): Promise<Application[]> {
    try {
      const q = query(collection(db, 'applications'), where('workerId', '==', workerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
    } catch (error) {
      debugLogger.error('Error fetching worker applications:', error);
      handleFirestoreError(error, OperationType.LIST, 'applications');
      return [];
    }
  },

  async getByEmployer(employerId: string): Promise<Application[]> {
    try {
      const q = query(collection(db, 'applications'), where('employerId', '==', employerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Application));
    } catch (error) {
      debugLogger.error('Error fetching employer applications:', error);
      handleFirestoreError(error, OperationType.LIST, 'applications');
      return [];
    }
  },

  async approve(applicationId: string): Promise<boolean> {
    return this.update(applicationId, { status: 'accepted' });
  },

  async reject(applicationId: string): Promise<boolean> {
    return this.update(applicationId, { status: 'rejected' });
  },

  async updateStatus(
    applicationId: string,
    status: Application['status'],
    workerId: string,
    jobTitle: string,
    meta?: { reviewedBy?: string; reason?: string }
  ): Promise<boolean> {
    try {
      const updates: Partial<Application> & Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (meta?.reviewedBy) updates.reviewedBy = meta.reviewedBy;
      if (meta?.reason) updates.reviewNote = meta.reason;

      await updateDoc(doc(db, 'applications', applicationId), updates);

      if (status === 'accepted') {
        await notificationService.notifyApplicationAccepted(workerId, jobTitle);
      } else if (status === 'rejected') {
        await notificationService.notifyApplicationRejected(workerId, jobTitle);
      }

      return true;
    } catch (error) {
      debugLogger.error('Error updating application status:', error);
      handleFirestoreError(error, OperationType.UPDATE, `applications/${applicationId}`);
      return false;
    }
  },
};
