import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import systemLogService from './systemLogService';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}

class RateLimitService {
  /**
   * Check if user has exceeded their weekly job posting limit
   */
  async checkJobPostLimit(userId: string, maxPosts: number = 5): Promise<RateLimitCheckResult> {
    try {
      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);

      // Query jobs created by this user in the last 7 days
      const q = query(
        collection(db, 'jobs'),
        where('employerId', '==', userId),
        where('createdAt', '>=', sevenDaysAgoTs)
      );

      const snapshot = await getDocs(q);
      const count = snapshot.size;

      const allowed = count < maxPosts;
      const message = allowed
        ? undefined
        : "Kechirasiz, siz haftalik maksimal ish e'lonlari limitiga yetdingiz. Iltimos keyingi haftani kuting.";

      return {
        allowed,
        currentCount: count,
        limit: maxPosts,
        message
      };
    } catch (error) {
      debugLogger.error('Error checking job post limit:', error);
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      // Allow on error (fail open for user experience)
      return {
        allowed: true,
        currentCount: 0,
        limit: maxPosts
      };
    }
  }

  /**
   * Check if user has exceeded their service post limit
   */
  async checkServicePostLimit(userId: string, maxPosts: number = 3): Promise<RateLimitCheckResult> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTs = Timestamp.fromDate(sevenDaysAgo);

      const q = query(
        collection(db, 'service_posts'),
        where('userId', '==', userId),
        where('createdAt', '>=', sevenDaysAgoTs)
      );

      const snapshot = await getDocs(q);
      const count = snapshot.size;

      const allowed = count < maxPosts;
      const message = allowed
        ? undefined
        : "Kechirasiz, siz haftalik maksimal xizmat e'lonlari limitiga yetdingiz. Iltimos keyingi haftani kuting.";

      return {
        allowed,
        currentCount: count,
        limit: maxPosts,
        message
      };
    } catch (error) {
      debugLogger.error('Error checking service post limit:', error);
      handleFirestoreError(error, OperationType.LIST, 'service_posts');
      return {
        allowed: true,
        currentCount: 0,
        limit: maxPosts
      };
    }
  }

  /**
   * Check daily application limit
   */
  async checkApplicationLimit(userId: string, maxApps: number = 10): Promise<RateLimitCheckResult> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTs = Timestamp.fromDate(today);

      const q = query(
        collection(db, 'applications'),
        where('workerId', '==', userId),
        where('createdAt', '>=', todayTs)
      );

      const snapshot = await getDocs(q);
      const count = snapshot.size;

      const allowed = count < maxApps;
      const message = allowed
        ? undefined
        : "Kechirasiz, siz kunlik ishtiromi limitiga yetdingiz. Iltimos ertaga qayta urinib ko'ring.";

      return {
        allowed,
        currentCount: count,
        limit: maxApps,
        message
      };
    } catch (error) {
      debugLogger.error('Error checking application limit:', error);
      handleFirestoreError(error, OperationType.LIST, 'applications');
      return {
        allowed: true,
        currentCount: 0,
        limit: maxApps
      };
    }
  }

  /**
   * Log rate limit violation
   */
  async logRateLimitViolation(userId: string, limitType: string, details: Record<string, any>) {
    await systemLogService.logAction(
      `RATE_LIMIT_EXCEEDED_${limitType.toUpperCase()}`,
      userId,
      undefined,
      details,
      'warning'
    );
  }
}

export default new RateLimitService();
