import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, boundingBox, approxDistanceLabel, isValidLatLng } from './geo.util';

test('haversineKm: same point is zero', () => {
  assert.equal(haversineKm(39.65, 66.96, 39.65, 66.96), 0);
});

test('haversineKm: Samarkand → Tashkent ~ 270km', () => {
  const d = haversineKm(39.627, 66.975, 41.311, 69.24);
  assert.ok(d > 240 && d < 300, `expected ~270, got ${d}`);
});

test('boundingBox: contains the center and widens with radius', () => {
  const box = boundingBox(39.65, 66.96, 30);
  assert.ok(box.minLat < 39.65 && box.maxLat > 39.65);
  assert.ok(box.minLng < 66.96 && box.maxLng > 66.96);
  const wider = boundingBox(39.65, 66.96, 60);
  assert.ok(wider.maxLat - wider.minLat > box.maxLat - box.minLat);
});

test('approxDistanceLabel: buckets, never exact', () => {
  assert.equal(approxDistanceLabel(0.4), '~1 km');
  assert.equal(approxDistanceLabel(7), '~7 km');
  assert.equal(approxDistanceLabel(23), '~25 km');
  assert.equal(approxDistanceLabel(132), '~130 km');
  assert.equal(approxDistanceLabel(-5), '—');
});

test('isValidLatLng: rejects out-of-range and non-numbers', () => {
  assert.equal(isValidLatLng(39.65, 66.96), true);
  assert.equal(isValidLatLng(91, 0), false);
  assert.equal(isValidLatLng(0, 181), false);
  assert.equal(isValidLatLng('39', 66), false);
  assert.equal(isValidLatLng(undefined, undefined), false);
});
