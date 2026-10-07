import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  PRICE_DEFAULT,
  pickRoundPrice,
  snapPrice,
} from './subscription.config';

test('snapPrice snaps to the nearest round step within bounds', () => {
  assert.equal(snapPrice(255_000), 260_000);
  assert.equal(snapPrice(254_000), 250_000);
  assert.equal(snapPrice(243_000), 240_000);
  assert.equal(snapPrice(299_999), 300_000);
});

test('snapPrice clamps out-of-range values', () => {
  assert.equal(snapPrice(100_000), PRICE_MIN);
  assert.equal(snapPrice(900_000), PRICE_MAX);
});

test('snapPrice falls back to default on non-finite input', () => {
  assert.equal(snapPrice(NaN), PRICE_DEFAULT);
  assert.equal(snapPrice(Infinity), PRICE_DEFAULT);
});

test('pickRoundPrice returns a round price in range for every step', () => {
  const steps = Math.floor((PRICE_MAX - PRICE_MIN) / PRICE_STEP);
  for (let i = 0; i <= steps; i++) {
    const price = pickRoundPrice(() => i);
    assert.equal(price % PRICE_STEP, 0, `${price} must end in 000`);
    assert.ok(price >= PRICE_MIN && price <= PRICE_MAX, `${price} in range`);
    assert.equal(price, PRICE_MIN + i * PRICE_STEP);
  }
});

test('pickRoundPrice clamps a step index outside [0, steps]', () => {
  assert.equal(pickRoundPrice(() => -5), PRICE_MIN);
  assert.equal(pickRoundPrice(() => 999), PRICE_MAX);
});
