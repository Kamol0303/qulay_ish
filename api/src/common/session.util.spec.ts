import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSessionCurrent } from './session.util';

test('existing sessions stay valid until a cutoff is stored', () => {
  assert.equal(isSessionCurrent(1_700_000_000, null), true);
  assert.equal(isSessionCurrent(undefined, null), true);
});

test('logout cutoff rejects older tokens and keeps a newer login', () => {
  const cutoff = new Date('2026-10-17T12:00:00.000Z');
  const older = Math.floor(cutoff.getTime() / 1000) - 10;
  const sameSecond = Math.floor(cutoff.getTime() / 1000);
  assert.equal(isSessionCurrent(older, cutoff), false);
  assert.equal(isSessionCurrent(sameSecond, cutoff), true);
  assert.equal(isSessionCurrent(undefined, cutoff), false);
});
