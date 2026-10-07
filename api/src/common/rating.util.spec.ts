import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clampStars, foldRating } from './rating.util';

test('clampStars keeps valid 1..5 integers', () => {
  assert.equal(clampStars(1), 1);
  assert.equal(clampStars(5), 5);
  assert.equal(clampStars(3), 3);
});

test('clampStars rounds and clamps out-of-range input', () => {
  assert.equal(clampStars(0), 1);
  assert.equal(clampStars(9), 5);
  assert.equal(clampStars(4.4), 4);
  assert.equal(clampStars(4.6), 5);
  assert.equal(clampStars('abc'), 0);
});

test('foldRating sets the first review as the average', () => {
  const r = foldRating(0, 0, 5);
  assert.equal(r.rating, 5);
  assert.equal(r.reviewCount, 1);
});

test('foldRating averages subsequent reviews', () => {
  // existing avg 5 over 1 review, add a 3 → (5 + 3) / 2 = 4
  const r = foldRating(5, 1, 3);
  assert.equal(r.rating, 4);
  assert.equal(r.reviewCount, 2);
});

test('foldRating rounds to one decimal place', () => {
  // existing avg 4 over 2 reviews (total 8), add a 5 → 13 / 3 = 4.333..
  const r = foldRating(4, 2, 5);
  assert.equal(r.rating, 4.3);
  assert.equal(r.reviewCount, 3);
});

test('foldRating clamps the incoming rating', () => {
  const r = foldRating(0, 0, 99);
  assert.equal(r.rating, 5);
});
