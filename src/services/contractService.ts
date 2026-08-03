import { debugLogger } from '../lib/debugLogger';
import { Contract } from '../types';
import { notificationService } from './notificationService';
import { api } from '../lib/api';
import { ApiError } from '../lib/api/client';

function isSignedByWorker(c: Partial<Contract> | null | undefined) {
  return Boolean(c?.signedByWorker ?? c?.workerSigned);
}

function isSignedByEmployer(c: Partial<Contract> | null | undefined) {
  return Boolean(c?.signedByEmployer ?? c?.employerSigned);
}

export const contractService = {
  async create(contractData: {
    applicationId?: string;
    jobId: string;
    workerId: string;
    employerId: string;
    title: string;
    amount: number;
    terms?: string;
    startDate?: string;
    endDate?: string;
    workerName?: string;
    employerName?: string;
  }): Promise<string> {
    try {
      // Preferred path: server loads worker/employer/job from the application (avoids FK/mismatch bugs)
      if (contractData.applicationId) {
        const created = await api.contracts.createFromApplication(contractData.applicationId, {
          amount: contractData.amount,
          terms: contractData.terms,
          startDate: contractData.startDate,
          endDate: contractData.endDate,
        });
        return created.id;
      }

      const created = await api.contracts.create({
        jobId: contractData.jobId,
        workerId: contractData.workerId,
        employerId: contractData.employerId,
        jobTitle: contractData.title,
        workerName: contractData.workerName,
        employerName: contractData.employerName,
        amount: contractData.amount,
        terms: contractData.terms,
        startDate: contractData.startDate,
        endDate: contractData.endDate,
        status: 'draft',
        signedByWorker: false,
        signedByEmployer: false,
        adminApproved: false,
      });
      return created.id;
    } catch (error) {
      debugLogger.error('Error creating contract:', error);
      if (error instanceof ApiError) throw error;
      throw new Error('Shartnoma yaratib bo‘lmadi');
    }
  },

  async signByWorker(contractId: string, workerId: string, employerId: string, jobTitle: string): Promise<boolean> {
    try {
      const contract = await api.contracts.get(contractId);
      const updates: Partial<Contract> = { signedByWorker: true, workerSigned: true };
      if (isSignedByEmployer(contract)) {
        updates.status = 'active';
        updates.startDate = new Date().toISOString();
      }
      await api.contracts.update(contractId, updates);
      await notificationService.notifyContractSigned(employerId, 'employer', jobTitle);
      return true;
    } catch (error) {
      debugLogger.error('Error signing contract by worker:', error);
      return false;
    }
  },

  async signByEmployer(contractId: string, employerId: string, workerId: string, jobTitle: string): Promise<boolean> {
    try {
      const contract = await api.contracts.get(contractId);
      const updates: Partial<Contract> = { signedByEmployer: true, employerSigned: true };
      if (isSignedByWorker(contract)) {
        updates.status = 'active';
        updates.startDate = new Date().toISOString();
      }
      await api.contracts.update(contractId, updates);
      await notificationService.notifyContractSigned(workerId, 'worker', jobTitle);
      return true;
    } catch (error) {
      debugLogger.error('Error signing contract by employer:', error);
      return false;
    }
  },

  async complete(contractId: string, workerId: string, employerId: string, jobTitle: string, amount: number): Promise<boolean> {
    try {
      await api.contracts.update(contractId, {
        status: 'completed',
        endDate: new Date().toISOString(),
      });
      await notificationService.notifyContractCompleted(workerId, jobTitle, amount);
      await notificationService.notifyContractCompleted(employerId, jobTitle, amount);

      const worker = await api.users.get(workerId);
      await api.users.update(workerId, { completedJobs: (worker.completedJobs || 0) + 1 });
      return true;
    } catch (error) {
      debugLogger.error('Error completing contract:', error);
      return false;
    }
  },

  async cancel(contractId: string, reason?: string): Promise<boolean> {
    try {
      await api.contracts.update(contractId, { status: 'cancelled', terms: reason });
      return true;
    } catch (error) {
      debugLogger.error('Error cancelling contract:', error);
      return false;
    }
  },

  async getById(contractId: string): Promise<Contract | null> {
    try {
      return await api.contracts.get(contractId);
    } catch {
      return null;
    }
  },

  async getByWorker(workerId: string): Promise<Contract[]> {
    return api.contracts.list({ workerId });
  },

  async getByEmployer(employerId: string): Promise<Contract[]> {
    return api.contracts.list({ employerId });
  },

  async list(params?: Record<string, string>): Promise<Contract[]> {
    return api.contracts.list(params);
  },
};
