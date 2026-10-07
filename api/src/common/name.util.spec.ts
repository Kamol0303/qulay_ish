import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFullName, composeFullName, normalizeNameInput } from './name.util';

test('splitFullName: first token is first name, rest is last name', () => {
  assert.deepEqual(splitFullName('Ali Valiyev'), { firstName: 'Ali', lastName: 'Valiyev' });
  assert.deepEqual(splitFullName('Ali Botir Valiyev'), {
    firstName: 'Ali',
    lastName: 'Botir Valiyev',
  });
  assert.deepEqual(splitFullName('Ali'), { firstName: 'Ali', lastName: '' });
  assert.deepEqual(splitFullName('   '), { firstName: '', lastName: '' });
  assert.deepEqual(splitFullName(null), { firstName: '', lastName: '' });
});

test('composeFullName: joins and falls back', () => {
  assert.equal(composeFullName('Ali', 'Valiyev'), 'Ali Valiyev');
  assert.equal(composeFullName('', '', 'Fallback Name'), 'Fallback Name');
  assert.equal(composeFullName('Ali', ''), 'Ali');
});

test('normalizeNameInput: prefers split fields and recomposes fullName', () => {
  assert.deepEqual(normalizeNameInput({ firstName: 'Ali', lastName: 'Valiyev' }), {
    firstName: 'Ali',
    lastName: 'Valiyev',
    fullName: 'Ali Valiyev',
  });
});

test('normalizeNameInput: derives split from fullName when no split given', () => {
  assert.deepEqual(normalizeNameInput({ fullName: 'Ali Botir Valiyev' }), {
    firstName: 'Ali',
    lastName: 'Botir Valiyev',
    fullName: 'Ali Botir Valiyev',
  });
});
