import { debugLogger } from '../lib/debugLogger';
import { Contract } from '../types';
import { notificationService } from './notificationService';
import { api } from '../lib/api';

export const contractService = {
  async create(contractData: {
    jobId: string;
    workerId: string;
    employerId: string;
    title: string;
    amount: number;
    terms?: string;
  }): Promise<string | null> {
    try {
      const created = await api.contracts.create({
        jobId: contractData.jobId,
        workerId: contractData.workerId,
        employerId: contractData.employerId,
        jobTitle: contractData.title,
        amount: contractData.amount,
        terms: contractData.terms,
        status: 'draft',
        workerSigned: false,
        employerSigned: false,
      });

      await notificationService.notifyNewContract(contractData.workerId, 'worker', contractData.title, created.id);
      await notificationService.notifyNewContract(contractData.employerId, 'employer', contractData.title, created.id);
      return created.id;
    } catch (error) {
      debugLogger.error('Error creating contract:', error);
      return null;
    }
  },

  async signByWorker(contractId: string, workerId: string, employerId: string, jobTitle: string): Promise<boolean> {
    try {
      const contract = await api.contracts.get(contractId);
      const updates: Partial<Contract> = { workerSigned: true, signedByWorker: true };
      if (contract.employerSigned) {
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
      const updates: Partial<Contract> = { employerSigned: true, signedByEmployer: true };
      if (contract.workerSigned) {
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
