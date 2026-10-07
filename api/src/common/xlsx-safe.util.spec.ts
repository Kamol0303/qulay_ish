import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeCell, riskIndex, XLSX_EMPTY } from './xlsx-safe.util';

test('safeCell: empty values become "-"', () => {
  assert.equal(safeCell(null), XLSX_EMPTY);
  assert.equal(safeCell(undefined), XLSX_EMPTY);
  assert.equal(safeCell(''), XLSX_EMPTY);
  assert.equal(safeCell('   '), XLSX_EMPTY);
});

test('safeCell: formula-injection leads are neutralized with a quote', () => {
  assert.equal(safeCell('=1+1'), "'=1+1");
  assert.equal(safeCell('+1'), "'+1");
  assert.equal(safeCell('-1'), "'-1");
  assert.equal(safeCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(safeCell('\tTAB'), "'\tTAB");
});

test('safeCell: safe strings and finite numbers pass through', () => {
  assert.equal(safeCell('Ali Valiyev'), 'Ali Valiyev');
  assert.equal(safeCell(42), 42);
  assert.equal(safeCell(0), 0);
});

test('safeCell: non-finite numbers become "-"', () => {
  assert.equal(safeCell(Number.NaN), XLSX_EMPTY);
  assert.equal(safeCell(Infinity), XLSX_EMPTY);
});

test('riskIndex: averages known risk levels', () => {
  assert.equal(riskIndex({ earlyMarriageRisk: 'high', violenceRisk: 'low' }), 2);
  assert.equal(riskIndex({ earlyMarriageRisk: 'critical', violenceRisk: 'critical' }), 4);
  assert.equal(riskIndex(null), XLSX_EMPTY);
  assert.equal(riskIndex({}), XLSX_EMPTY);
});
