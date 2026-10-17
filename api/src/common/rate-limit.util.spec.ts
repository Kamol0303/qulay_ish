import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decideRateLimit, type RateBucket } from './rate-limit.util';

test('stats and list polling stay under the general limit', () => {
  const buckets = new Map<string, RateBucket>();
  const now = 1_000_000;
  for (let i = 0; i < 30; i += 1) {
    const decision = decideRateLimit(buckets, '/api/stats/counts', '203.0.113.8', now);
    assert.equal(decision.ok, true);
  }
});

test('OTP sends stop after the auth window is full', () => {
  const buckets = new Map<string, RateBucket>();
  const now = 1_000_000;
  for (let i = 0; i < 20; i += 1) {
    assert.equal(decideRateLimit(buckets, '/api/auth/send-otp', '203.0.113.9', now).ok, true);
  }
  const blocked = decideRateLimit(buckets, '/api/auth/send-otp', '203.0.113.9', now);
  assert.equal(blocked.ok, false);
});
