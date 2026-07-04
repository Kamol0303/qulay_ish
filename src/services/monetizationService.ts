import { debugLogger } from '../lib/debugLogger';
import { api } from '../lib/api';
import { jobService } from './jobService';

export interface PaymentDetails {
  amount: number;
  currency: string;
  provider: 'payme' | 'click' | 'uzum';
  transactionId: string;
}

export const monetizationService = {
  async upgradeToPremium(userId: string, months: number = 1) {
    try {
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + months);

      await api.users.update(userId, {
        isPremium: true,
        ...( { premiumUntil: expirationDate.toISOString() } as Record<string, unknown> ),
      });

      return { success: true, expiresAt: expirationDate };
    } catch (error) {
      debugLogger.error('Failed to upgrade to premium:', error);
      return { success: false, error };
    }
  },

  async promoteJob(jobId: string, days: number = 7) {
    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + days);

      await jobService.update(jobId, {
        ...( { isPromoted: true, promotedUntil: expirationDate.toISOString() } as Record<string, unknown> ),
      });

      return { success: true, expiresAt: expirationDate };
    } catch (error) {
      debugLogger.error('Failed to promote job:', error);
      return { success: false, error };
    }
  },

  async recordCommission(_contractId: string, _amount: number) {
    try {
      return { success: true };
    } catch (error) {
      debugLogger.error('Failed to record commission:', error);
      return { success: false };
    }
  },
};
