import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

// ============================================
// PAYMENT TYPES
// ============================================

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
  metadata?: {
    contractId?: string;
    jobId?: string;
    months?: number;
    description?: string;
  };
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

// ============================================
// PAYMENT CONFIGURATION
// ============================================

class PaymentConfig {
  private static instance: PaymentConfig;
  
  // These should come from environment variables
  // NEVER hardcode API keys here
  private config = {
    payme: {
      merchantId: import.meta.env.VITE_PAYME_MERCHANT_ID || '',
      enabled: import.meta.env.VITE_PAYME_ENABLED === 'true'
    },
    click: {
      merchantId: import.meta.env.VITE_CLICK_MERCHANT_ID || '',
      serviceId: import.meta.env.VITE_CLICK_SERVICE_ID || '',
      enabled: import.meta.env.VITE_CLICK_ENABLED === 'true'
    },
    uzum: {
      merchantId: import.meta.env.VITE_UZUM_MERCHANT_ID || '',
      enabled: import.meta.env.VITE_UZUM_ENABLED === 'true'
    },
    stripe: {
      publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
      enabled: import.meta.env.VITE_STRIPE_ENABLED === 'true'
    }
  };

  private constructor() {}

  static getInstance(): PaymentConfig {
    if (!PaymentConfig.instance) {
      PaymentConfig.instance = new PaymentConfig();
    }
    return PaymentConfig.instance;
  }

  getProviderConfig(provider: PaymentProvider) {
    return this.config[provider];
  }

  isProviderEnabled(provider: PaymentProvider): boolean {
    return this.config[provider]?.enabled || false;
  }

  getEnabledProviders(): PaymentProvider[] {
    return Object.entries(this.config)
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider as PaymentProvider);
  }
}

// ============================================
// PAYMENT PROVIDER INTERFACE
// ============================================

interface IPaymentProvider {
  initialize(): Promise<boolean>;
  createPayment(data: PaymentData): Promise<PaymentResult>;
  verifyPayment(transactionId: string): Promise<boolean>;
  refundPayment(transactionId: string): Promise<boolean>;
}

// ============================================
// PAYME PROVIDER (Uzbekistan)
// ============================================

class PaymeProvider implements IPaymentProvider {
  async initialize(): Promise<boolean> {
    const config = PaymentConfig.getInstance().getProviderConfig('payme') as any;
    return !!config.merchantId;
  }

  async createPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      // In production, this would call Payme API
      // For now, we create a payment record and return a mock URL
      
      const paymentDoc = await addDoc(collection(db, 'payments'), {
        ...data,
        provider: 'payme',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // In production, you would:
      // 1. Call Payme API to create payment
      // 2. Get redirect URL from Payme
      // 3. Return that URL
      
      return {
        success: true,
        paymentId: paymentDoc.id,
        redirectUrl: `/payment/payme/${paymentDoc.id}` // Mock URL
      };
    } catch (error) {
      debugLogger.error('Payme payment error:', error);
      return {
        success: false,
        error: 'Failed to create Payme payment'
      };
    }
  }

  async verifyPayment(transactionId: string): Promise<boolean> {
    // In production, verify with Payme API
    return true;
  }

  async refundPayment(transactionId: string): Promise<boolean> {
    // In production, call Payme refund API
    return true;
  }
}

// ============================================
// CLICK PROVIDER (Uzbekistan)
// ============================================

class ClickProvider implements IPaymentProvider {
  async initialize(): Promise<boolean> {
    const config = PaymentConfig.getInstance().getProviderConfig('click') as any;
    return !!config.merchantId && !!config.serviceId;
  }

  async createPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      const paymentDoc = await addDoc(collection(db, 'payments'), {
        ...data,
        provider: 'click',
        status: 'pending',
        createdAt: serverTimestamp()
      });

      return {
        success: true,
        paymentId: paymentDoc.id,
        redirectUrl: `/payment/click/${paymentDoc.id}`
      };
    } catch (error) {
      debugLogger.error('Click payment error:', error);
      return {
        success: false,
        error: 'Failed to create Click payment'
      };
    }
  }

  async verifyPayment(transactionId: string): Promise<boolean> {
    return true;
  }

  async refundPayment(transactionId: string): Promise<boolean> {
    return true;
  }
}

// ============================================
// PAYMENT SERVICE
// ============================================

export const paymentService = {
  /**
   * Get available payment providers
   */
  getAvailableProviders(): PaymentProvider[] {
    return PaymentConfig.getInstance().getEnabledProviders();
  },

  /**
   * Create a payment
   */
  async createPayment(data: PaymentData): Promise<PaymentResult> {
    try {
      // Validate provider is enabled
      if (!PaymentConfig.getInstance().isProviderEnabled(data.provider)) {
        return {
          success: false,
          error: 'Payment provider not enabled'
        };
      }

      // Get provider instance
      let provider: IPaymentProvider;
      switch (data.provider) {
        case 'payme':
          provider = new PaymeProvider();
          break;
        case 'click':
          provider = new ClickProvider();
          break;
        default:
          return {
            success: false,
            error: 'Unsupported payment provider'
          };
      }

      // Initialize provider
      const initialized = await provider.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Payment provider not configured'
        };
      }

      // Create payment
      return await provider.createPayment(data);
    } catch (error) {
      debugLogger.error('Payment creation error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'payments');
      return {
        success: false,
        error: 'Failed to create payment'
      };
    }
  },

  /**
   * Upgrade user to premium
   */
  async upgradeToPremium(userId: string, months: number = 1): Promise<PaymentResult> {
    const amount = months * 50000; // 50,000 UZS per month
    
    return this.createPayment({
      userId,
      amount,
      currency: 'UZS',
      type: 'premium_upgrade',
      provider: 'payme', // Default provider
      status: 'pending',
      metadata: {
        months,
        description: `Premium upgrade for ${months} month(s)`
      }
    });
  },

  /**
   * Process contract payment
   */
  async processContractPayment(
    userId: string,
    contractId: string,
    amount: number
  ): Promise<PaymentResult> {
    return this.createPayment({
      userId,
      amount,
      currency: 'UZS',
      type: 'contract_payment',
      provider: 'payme',
      status: 'pending',
      metadata: {
        contractId,
        description: 'Contract payment'
      }
    });
  },

  /**
   * Promote job listing
   */
  async promoteJob(userId: string, jobId: string, days: number = 7): Promise<PaymentResult> {
    const amount = days * 10000; // 10,000 UZS per day
    
    return this.createPayment({
      userId,
      amount,
      currency: 'UZS',
      type: 'job_promotion',
      provider: 'payme',
      status: 'pending',
      metadata: {
        jobId,
        description: `Job promotion for ${days} day(s)`
      }
    });
  },

  /**
   * Get user's payment history
   */
  async getPaymentHistory(userId: string): Promise<any[]> {
    try {
      const q = query(
        collection(db, 'payments'),
        where('userId', '==', userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      debugLogger.error('Error fetching payment history:', error);
      handleFirestoreError(error, OperationType.LIST, 'payments');
      return [];
    }
  },

  /**
   * Update payment status (typically called by webhook)
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    transactionId?: string
  ): Promise<boolean> {
    try {
      const updates: any = {
        status,
        updatedAt: serverTimestamp()
      };
      
      if (transactionId) {
        updates.transactionId = transactionId;
      }

      await updateDoc(doc(db, 'payments', paymentId), updates);
      return true;
    } catch (error) {
      debugLogger.error('Error updating payment status:', error);
      handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
      return false;
    }
  },

  /**
   * Verify payment (called after redirect back from provider)
   */
  async verifyPayment(paymentId: string, transactionId: string): Promise<boolean> {
    try {
      // In production, verify with payment provider
      // For now, just update status
      return await this.updatePaymentStatus(paymentId, 'completed', transactionId);
    } catch (error) {
      debugLogger.error('Payment verification error:', error);
      return false;
    }
  }
};
