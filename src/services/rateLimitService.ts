import { debugLogger } from '../lib/debugLogger';
import systemLogService from './systemLogService';
import { api } from '../lib/api';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  message?: string;
}

function countSince(items: Array<{ createdAt?: unknown }>, since: Date): number {
  return items.filter((item) => {
    const d = item.createdAt ? new Date(String(item.createdAt)) : null;
    return d && d >= since;
  }).length;
}

class RateLimitService {
  async checkJobPostLimit(userId: string, maxPosts: number = 5): Promise<RateLimitCheckResult> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const jobs = await api.jobs.list({ employerId: userId });
      const count = countSince(jobs, sevenDaysAgo);
      const allowed = count < maxPosts;
      return {
        allowed,
        currentCount: count,
        limit: maxPosts,
        message: allowed ? undefined : "Kechirasiz, siz haftalik maksimal ish e'lonlari limitiga yetdingiz.",
      };
    } catch (error) {
      debugLogger.error('Error checking job post limit:', error);
      return { allowed: true, currentCount: 0, limit: maxPosts };
    }
  }

  async checkServicePostLimit(userId: string, maxPosts: number = 3): Promise<RateLimitCheckResult> {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const posts = await api.servicePosts.list({ workerId: userId });
      const count = countSince(posts, sevenDaysAgo);
      const allowed = count < maxPosts;
      return {
        allowed,
        currentCount: count,
        limit: maxPosts,
        message: allowed ? undefined : "Kechirasiz, siz haftalik maksimal xizmat e'lonlari limitiga yetdingiz.",
      };
    } catch (error) {
      debugLogger.error('Error checking service post limit:', error);
      return { allowed: true, currentCount: 0, limit: maxPosts };
    }
  }

  async checkApplicationLimit(userId: string, maxApps: number = 10): Promise<RateLimitCheckResult> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const apps = await api.applications.list({ workerId: userId });
      const count = countSince(apps, today);
      const allowed = count < maxApps;
      return {
        allowed,
        currentCount: count,
        limit: maxApps,
        message: allowed ? undefined : "Kechirasiz, siz kunlik ishtiromi limitiga yetdingiz.",
      };
    } catch (error) {
      debugLogger.error('Error checking application limit:', error);
      return { allowed: true, currentCount: 0, limit: maxApps };
    }
  }

  async logRateLimitViolation(userId: string, limitType: string, details: Record<string, unknown>) {
    await systemLogService.logAction(`RATE_LIMIT_EXCEEDED_${limitType.toUpperCase()}`, userId, undefined, details, 'warning');
  }
}

export default new RateLimitService();
