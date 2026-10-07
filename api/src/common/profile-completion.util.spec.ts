import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileCompletionPercent } from './profile-completion.util';

test('worker: empty profile is 0%', () => {
  assert.equal(profileCompletionPercent({ role: 'worker' }), 0);
});

test('worker: fully populated profile is 100%', () => {
  const user = {
    role: 'worker',
    firstName: 'Ali',
    phoneNumber: '+998901234567',
    region: 'Samarqand',
    photoUrl: 'x.jpg',
    professionalSummary: 'exp',
    skills: ['a', 'b'],
    education: [{}],
    experience: [{}],
    certificates: [{}],
    portfolio: [{}],
  };
  assert.equal(profileCompletionPercent(user), 100);
});

test('employer: company + contact partial completion', () => {
  const pct = profileCompletionPercent({
    role: 'employer',
    companyName: 'Acme',
    phoneNumber: '+998901234567',
  });
  assert.ok(pct > 0 && pct < 100, `expected partial, got ${pct}`);
});
