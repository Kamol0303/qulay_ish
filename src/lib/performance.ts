import { debugLogger } from './debugLogger';
import { api } from './api';

/**
 * Performance & scale utilities backed by the REST API.
 */
export const performanceUtils = {
  async getStatsCounts() {
    return api.stats.counts();
  },

  async getCollectionCount(
    resource: 'users' | 'jobs' | 'applications' | 'contracts',
    params?: Record<string, string>,
  ): Promise<number> {
    try {
      switch (resource) {
        case 'users':
          return (await api.users.list(params)).length;
        case 'jobs':
          return (await api.jobs.list(params)).length;
        case 'applications':
          return (await api.applications.list(params)).length;
        case 'contracts':
          return (await api.contracts.list(params)).length;
        default:
          return 0;
      }
    } catch (error) {
      debugLogger.error('Error getting collection count:', error);
      return 0;
    }
  },

  sortByCreatedAtDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const ta = new Date(a.createdAt as string | number | Date ?? 0).getTime();
      const tb = new Date(b.createdAt as string | number | Date ?? 0).getTime();
      return tb - ta;
    });
  },

  paginate<T>(items: T[], pageSize: number, page: number): { items: T[]; hasMore: boolean } {
    const start = page * pageSize;
    const slice = items.slice(start, start + pageSize);
    return { items: slice, hasMore: start + pageSize < items.length };
  },
};
