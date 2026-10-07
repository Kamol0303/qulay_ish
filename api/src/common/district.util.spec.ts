import { test } from 'node:test';
import assert from 'node:assert/strict';
import { districtDistanceKm, districtProximityKey } from './district.util';
import { SAMARQAND_DISTRICTS, isValidDistrictId } from './samarqand-districts';

test('district list has the expected 18 Samarqand districts/cities', () => {
  assert.equal(SAMARQAND_DISTRICTS.length, 18);
  assert.equal(SAMARQAND_DISTRICTS.filter((d) => d.type === 'city').length, 4);
  assert.equal(SAMARQAND_DISTRICTS.filter((d) => d.type === 'district').length, 14);
});

test('isValidDistrictId accepts canonical ids and rejects others', () => {
  assert.ok(isValidDistrictId('urgut'));
  assert.ok(isValidDistrictId('samarqand_shahri'));
  assert.ok(!isValidDistrictId('tashkent'));
  assert.ok(!isValidDistrictId(''));
  assert.ok(!isValidDistrictId(undefined));
});

test('same district has zero distance', () => {
  assert.equal(districtDistanceKm('urgut', 'urgut'), 0);
});

test('distance grows with real-world separation', () => {
  const near = districtDistanceKm('samarqand_shahri', 'samarqand_tumani')!;
  const far = districtDistanceKm('samarqand_shahri', 'qoshrabot')!;
  assert.ok(near >= 0);
  assert.ok(far > near, 'Qoʻshrabot must be farther from the city than Samarqand tumani');
});

test('unknown district yields null distance and sinks in proximity order', () => {
  assert.equal(districtDistanceKm('urgut', 'nowhere'), null);
  assert.equal(districtDistanceKm(null, 'urgut'), null);
  assert.ok(districtProximityKey('urgut', 'nowhere') > districtProximityKey('urgut', 'toyloq'));
});
