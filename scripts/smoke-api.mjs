#!/usr/bin/env node
// Local smoke. Does not call production.
const base = process.env.API_BASE || 'http://127.0.0.1:4000';
if (base.includes('ishliayol.uz') || base.includes('mexrliqollar.uz')) {
  console.error('Refusing to smoke-test production');
  process.exit(1);
}

const health = await fetch(`${base}/api/health`);
if (!health.ok) {
  console.error('health failed', health.status);
  process.exit(1);
}

const counts = await fetch(`${base}/api/stats/counts`);
const body = await counts.json();
const keys = [
  'users',
  'jobs',
  'applications',
  'contracts',
  'workers',
  'employers',
  'activeJobs',
  'pendingApplications',
  'activeContracts',
  'completedContracts',
];
for (const key of keys) {
  if (typeof body[key] !== 'number') {
    console.error('missing count', key);
    process.exit(1);
  }
}
console.log('smoke ok', body.users, body.workers, body.employers, body.activeJobs, body.jobs);
