import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  PRICE_DEFAULT,
  pickRoundPrice,
  snapPrice,
  monthlyPrice,
  describePeriod,
  SUBSCRIPTION_FREE_DAYS,
  SUBSCRIPTION_WARNING_DAYS,
} from './subscription.config';

test('snapPrice snaps to the nearest round step within bounds', () => {
  assert.equal(snapPrice(255_000), 260_000);
  assert.equal(snapPrice(254_000), 250_000);
  assert.equal(snapPrice(443_000), 440_000);
  assert.equal(snapPrice(449_999), 450_000);
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

test('monthlyPrice is deterministic for a given month', () => {
  const a = monthlyPrice(new Date(Date.UTC(2026, 9, 15)));
  const b = monthlyPrice(new Date(Date.UTC(2026, 9, 1)));
  assert.equal(a, b, 'same month → same price');
});

test('monthlyPrice is always a round price inside bounds', () => {
  for (let year = 2025; year <= 2027; year++) {
    for (let month = 0; month < 12; month++) {
      const price = monthlyPrice(new Date(Date.UTC(year, month, 1)));
      assert.equal(price % PRICE_STEP, 0, `${price} must end in 000`);
      assert.ok(price >= PRICE_MIN && price <= PRICE_MAX, `${price} in range`);
    }
  }
});

const DAY = 24 * 60 * 60 * 1000;

test('describePeriod stays open for the whole month', () => {
  const until = Date.UTC(2026, 10, 8);
  const early = describePeriod(until - 20 * DAY, until);
  assert.equal(early.status, 'active');
  assert.equal(early.blocked, false);
  assert.equal(early.inWarningWindow, false);
});

test('describePeriod warns during the last week and names the days left', () => {
  const until = Date.UTC(2026, 10, 8);
  const week = describePeriod(until - 7 * DAY + 1000, until);
  assert.equal(week.status, 'active');
  assert.equal(week.blocked, false);
  assert.equal(week.inWarningWindow, true);
  assert.equal(week.daysRemaining, SUBSCRIPTION_WARNING_DAYS);
  const oneDay = describePeriod(until - DAY + 1000, until);
  assert.equal(oneDay.inWarningWindow, true);
  assert.equal(oneDay.daysRemaining, 1);
});

test('describePeriod blocks as soon as the month ends', () => {
  const until = Date.UTC(2026, 10, 8);
  const expired = describePeriod(until + 1, until);
  assert.equal(expired.status, 'expired');
  assert.equal(expired.blocked, true);
  assert.equal(expired.inWarningWindow, false);
});

test('describePeriod with no end date does not block', () => {
  const open = describePeriod(Date.now(), null);
  assert.equal(open.status, 'active');
  assert.equal(open.blocked, false);
  assert.equal(open.daysRemaining, SUBSCRIPTION_FREE_DAYS);
});

test('monthlyPrice varies across months', () => {
  const prices = new Set<number>();
  for (let month = 0; month < 12; month++) {
    prices.add(monthlyPrice(new Date(Date.UTC(2026, month, 1))));
  }
  assert.ok(prices.size > 1, 'at least two distinct monthly prices in a year');
});
