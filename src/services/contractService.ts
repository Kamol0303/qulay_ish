import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Contract } from '../types';
import { notificationService } from './notificationService';

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
      const docRef = await addDoc(collection(db, 'contracts'), {
        ...contractData,
        status: 'draft',
        workerSigned: false,
        employerSigned: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Notify both parties
      await notificationService.notifyNewContract(contractData.workerId, 'worker', contractData.title, docRef.id);
      await notificationService.notifyNewContract(contractData.employerId, 'employer', contractData.title, docRef.id);

      return docRef.id;
    } catch (error) {
      debugLogger.error('Error creating contract:', error);
      handleFirestoreError(error, OperationType.WRITE, 'contracts');
      return null;
    }
  },

  async signByWorker(contractId: string, workerId: string, employerId: string, jobTitle: string): Promise<boolean> {
    try {
      const contractRef = doc(db, 'contracts', contractId);
      const contractSnap = await getDoc(contractRef);
      
      if (!contractSnap.exists()) return false;
      
      const contract = contractSnap.data() as Contract;
      const updates: any = {
        workerSigned: true,
        updatedAt: serverTimestamp()
      };

      // If employer already signed, activate contract
      if (contract.employerSigned) {
        updates.status = 'active';
        updates.startDate = serverTimestamp();
      }

      await updateDoc(contractRef, updates);

      // Notify employer
      await notificationService.notifyContractSigned(employerId, 'employer', jobTitle);

      return true;
    } catch (error) {
      debugLogger.error('Error signing contract by worker:', error);
      handleFirestoreError(error, OperationType.UPDATE, `contracts/${contractId}`);
      return false;
    }
  },

  async signByEmployer(contractId: string, employerId: string, workerId: string, jobTitle: string): Promise<boolean> {
    try {
      const contractRef = doc(db, 'contracts', contractId);
      const contractSnap = await getDoc(contractRef);
      
      if (!contractSnap.exists()) return false;
      
      const contract = contractSnap.data() as Contract;
      const updates: any = {
        employerSigned: true,
        updatedAt: serverTimestamp()
      };

      // If worker already signed, activate contract
      if (contract.workerSigned) {
        updates.status = 'active';
        updates.startDate = serverTimestamp();
      }

      await updateDoc(contractRef, updates);

      // Notify worker
      await notificationService.notifyContractSigned(workerId, 'worker', jobTitle);

      return true;
    } catch (error) {
      debugLogger.error('Error signing contract by employer:', error);
      handleFirestoreError(error, OperationType.UPDATE, `contracts/${contractId}`);
      return false;
    }
  },

  async complete(contractId: string, workerId: string, employerId: string, jobTitle: string, amount: number): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'contracts', contractId), {
        status: 'completed',
        endDate: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Notify both parties
      await notificationService.notifyContractCompleted(workerId, jobTitle, amount);
      await notificationService.notifyContractCompleted(employerId, jobTitle, amount);

      // Update worker's completed jobs count
      const workerRef = doc(db, 'profiles', workerId);
      const workerSnap = await getDoc(workerRef);
      if (workerSnap.exists()) {
        const currentCount = workerSnap.data().completedJobs || 0;
        await updateDoc(workerRef, {
          completedJobs: currentCount + 1,
          updatedAt: serverTimestamp()
        });
      }

      return true;
    } catch (error) {
      debugLogger.error('Error completing contract:', error);
      handleFirestoreError(error, OperationType.UPDATE, `contracts/${contractId}`);
      return false;
    }
  },

  async cancel(contractId: string, reason?: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'contracts', contractId), {
        status: 'cancelled',
        cancelReason: reason || '',
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      debugLogger.error('Error cancelling contract:', error);
      handleFirestoreError(error, OperationType.UPDATE, `contracts/${contractId}`);
      return false;
    }
  },

  async getById(contractId: string): Promise<Contract | null> {
    try {
      const docSnap = await getDoc(doc(db, 'contracts', contractId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Contract;
      }
      return null;
    } catch (error) {
      debugLogger.error('Error fetching contract:', error);
      handleFirestoreError(error, OperationType.GET, `contracts/${contractId}`);
      return null;
    }
  },

  async getByWorker(workerId: string): Promise<Contract[]> {
    try {
      const q = query(collection(db, 'contracts'), where('workerId', '==', workerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
    } catch (error) {
      debugLogger.error('Error fetching worker contracts:', error);
      handleFirestoreError(error, OperationType.LIST, 'contracts');
      return [];
    }
  },

  async getByEmployer(employerId: string): Promise<Contract[]> {
    try {
      const q = query(collection(db, 'contracts'), where('employerId', '==', employerId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));
    } catch (error) {
      debugLogger.error('Error fetching employer contracts:', error);
      handleFirestoreError(error, OperationType.LIST, 'contracts');
      return [];
    }
  }
};
