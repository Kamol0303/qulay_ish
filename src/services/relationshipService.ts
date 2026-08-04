import { api } from '../lib/api';

export const relationshipService = {
  /** Uses only the viewer's own applications/contracts (scoped API). */
  async hasActiveRelationship(userA: string, userB: string): Promise<boolean> {
    const [appsAsWorker, appsAsEmployer, contractsAsWorker, contractsAsEmployer] =
      await Promise.all([
        api.applications.list({ workerId: userA }).catch(() => []),
        api.applications.list({ employerId: userA }).catch(() => []),
        api.contracts.list({ workerId: userA, status: 'active' }).catch(() => []),
        api.contracts.list({ employerId: userA, status: 'active' }).catch(() => []),
      ]);

    const apps = [...appsAsWorker, ...appsAsEmployer];
    if (
      apps.some(
        (a) =>
          (a.workerId === userA && a.employerId === userB) ||
          (a.workerId === userB && a.employerId === userA),
      )
    ) {
      return true;
    }

    const contracts = [...contractsAsWorker, ...contractsAsEmployer];
    return contracts.some(
      (c) =>
        (c.workerId === userA && c.employerId === userB) ||
        (c.workerId === userB && c.employerId === userA),
    );
  },

  async canViewContact(viewerId: string, targetUserId: string): Promise<boolean> {
    if (viewerId === targetUserId) return true;
    return this.hasActiveRelationship(viewerId, targetUserId);
  },
};

export default relationshipService;
