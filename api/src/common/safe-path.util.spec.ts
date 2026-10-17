import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeChildPath } from './safe-path.util';

test('safeChildPath stays inside the private uploads root', () => {
  const root = '/tmp/uploads/private';
  const ok = safeChildPath(root, 'user_1', 'file-1.jpg');
  assert.equal(ok, '/tmp/uploads/private/user_1/file-1.jpg');
  assert.equal(safeChildPath(root, '../etc', 'passwd'), null);
  assert.equal(safeChildPath(root, 'user_1', '../secret.pdf'), null);
  assert.equal(safeChildPath(root, 'user_1', '..'), null);
});
