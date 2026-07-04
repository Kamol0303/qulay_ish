import { debugLogger } from '../lib/debugLogger';
import { api } from '../lib/api';

export type PaymentProvider = 'payme' | 'click' | 'uzum' | 'stripe';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentType = 'premium_upgrade' | 'contract_payment' | 'job_promotion' | 'verification_fee';

export interface PaymentData {
  userId: string;
  amount: number;
  currency: string;
  type: PaymentType;
  provider: PaymentProvider;
  status: PaymentStatus;
  metadata?: Record<string, unknown>;
}

export const paymentService = {
  async createPayment(data: PaymentData) {
    try {
      return await api.payments.create(data as unknown as Record<string, unknown>);
    } catch (error) {
      debugLogger.error('createPayment', error);
      return null;
    }
  },

  async updatePayment(paymentId: string, updates: Record<string, unknown>) {
    return api.payments.update(paymentId, updates);
  },

  async getUserPayments(userId: string) {
    return api.payments.list(userId);
  },
};
