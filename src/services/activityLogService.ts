import { api } from '../lib/api';

export const activityLogService = {
  async log(userId: string | undefined, action: string, details?: Record<string, unknown>) {
    return api.activityLogs.create({ userId, action, details });
  },

  async trackOnline(userId: string) {
    return api.activityLogs.create({ userId, action: 'online', details: { at: new Date().toISOString() } });
  },

  async list(userId?: string) {
    return api.activityLogs.list(userId);
  },
};

export default activityLogService;
