import { api } from '../lib/api';

export const analyticsService = {
  async getDashboardCounts() {
    return api.stats.counts();
  },

  async getUserStats() {
    const counts = await api.stats.counts();
    return { totalUsers: counts.users, totalJobs: counts.jobs, totalApplications: counts.applications, totalContracts: counts.contracts };
  },
};

export default analyticsService;
