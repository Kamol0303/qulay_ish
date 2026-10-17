import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePublicStats } from './statsCounts.ts';

test('dashboard snapshot stays 216 / 164 / 50 / 4 / 7 / 1 / 0', () => {
  const stats = normalizePublicStats({
    users: 216,
    jobs: 7,
    applications: 1,
    contracts: 0,
    workers: 164,
    employers: 50,
    activeJobs: 4,
    pendingApplications: 0,
    activeContracts: 0,
    completedContracts: 0,
  });
  assert.deepEqual(stats, {
    users: 216,
    jobs: 7,
    applications: 1,
    contracts: 0,
    workers: 164,
    employers: 50,
    activeJobs: 4,
    pendingApplications: 0,
    activeContracts: 0,
    completedContracts: 0,
  });
});

test('an older counts payload does not invent worker or employer zeros', () => {
  const stats = normalizePublicStats({ users: 216, jobs: 7, applications: 1, contracts: 0 });
  assert.equal(stats.users, 216);
  assert.equal(stats.workers, null);
  assert.equal(stats.employers, null);
  assert.equal(stats.activeJobs, 7);
  assert.equal(stats.pendingApplications, null);
  assert.equal(stats.activeContracts, 0);
  assert.equal(stats.completedContracts, null);
});
