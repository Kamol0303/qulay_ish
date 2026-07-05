import { api } from '../lib/api';

export const relationshipService = {
  async hasActiveRelationship(userA: string, userB: string): Promise<boolean> {
    const apps = await api.applications.list({ workerId: userA });
    const appsB = await api.applications.list({ workerId: userB });
    const allApps = [...apps, ...appsB];
    if (allApps.some((a) => (a.workerId === userA && a.employerId === userB) || (a.workerId === userB && a.employerId === userA))) {
      return true;
    }
    const contracts = await api.contracts.list({ status: 'active' });
    return contracts.some(
      (c) =>
        (c.workerId === userA && c.employerId === userB) ||
        (c.workerId === userB && c.employerId === userA)
    );
  },

  async canViewContact(viewerId: string, targetUserId: string): Promise<boolean> {
    if (viewerId === targetUserId) return true;
    return this.hasActiveRelationship(viewerId, targetUserId);
  },
};

export default relationshipService;
