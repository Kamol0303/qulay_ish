import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderOwnerPage } from './owner.page';
import { PlatformGateService } from './platform-gate.service';
import {
  allSectionsOn,
  decideAccess,
  defaultSnapshot,
  normalizeSections,
  otpPurposeAllowed,
  type GateSections,
} from './platform-gate.policy';
import { OWNER_PATH, isOwnerPhone } from './owner.constants';

const live = {
  path: '/api/stats/counts',
  method: 'GET',
  role: null,
  userId: null,
  state: 'live' as const,
  sections: allSectionsOn(),
};

test('a live site leaves ordinary reads open', () => {
  assert.equal(decideAccess(live).allow, true);
});

test('removed site hides data but keeps the control entry and the public switch', () => {
  const hidden = decideAccess({ ...live, state: 'removed', path: '/api/stats/counts' });
  assert.equal(hidden.allow, false);
  if (!hidden.allow) assert.equal(hidden.status, 404);
  const paused = decideAccess({ ...live, state: 'paused', path: '/api/jobs' });
  if (!paused.allow) assert.equal(paused.status, 503);
  assert.equal(decideAccess({ ...live, state: 'off', path: '/uploads/public/a.jpg' }).allow, false);
  assert.equal(decideAccess({ ...live, state: 'removed', path: OWNER_PATH }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'removed', path: '/api/gate' }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'removed', path: '/api/health' }).allow, true);
});

test('section switches close only that part', () => {
  const sections: GateSections = { ...allSectionsOn(), workers: false, chat: false, jobs: false };
  assert.equal(decideAccess({ ...live, sections, path: '/api/users' }).allow, false);
  assert.equal(
    decideAccess({ ...live, sections, path: '/api/users/me-1', userId: 'me-1' }).allow,
    true,
  );
  assert.equal(
    decideAccess({ ...live, sections, path: '/api/users/other', userId: 'me-1' }).allow,
    false,
  );
  assert.equal(decideAccess({ ...live, sections, path: '/api/chat-messages' }).allow, false);
  assert.equal(decideAccess({ ...live, sections, path: '/api/jobs/abc', method: 'POST' }).allow, false);
  assert.equal(decideAccess({ ...live, sections, path: '/api/auth/login', method: 'POST' }).allow, true);
});

test('staff panels can be closed without closing worker login', () => {
  const sections: GateSections = { ...allSectionsOn(), admin: false, superAdmin: false };
  assert.equal(
    decideAccess({ ...live, sections, role: 'admin', path: '/api/users' }).allow,
    false,
  );
  assert.equal(
    decideAccess({ ...live, sections, role: 'super_admin', path: '/api/auth/logout', method: 'POST' }).allow,
    true,
  );
  assert.equal(
    decideAccess({ ...live, sections, path: '/api/auth/super-admin/login', method: 'POST' }).allow,
    false,
  );
  assert.equal(decideAccess({ ...live, sections, role: 'worker', path: '/api/users/me', userId: 'me' }).allow, true);
});

test('owner phone accepts the international and local forms', () => {
  assert.equal(isOwnerPhone('+998995700913'), true);
  assert.equal(isOwnerPhone('998995700913'), true);
  assert.equal(isOwnerPhone('995700913'), true);
  assert.equal(isOwnerPhone('+998901112233'), false);
});

test('control page lists the switches and does not print the phone', () => {
  const html = renderOwnerPage({ authed: true, snap: defaultSnapshot() });
  const login = renderOwnerPage({ authed: false, snap: null, error: "Login yoki parol noto'g'ri." });
  for (const word of ['Ishga tushirish', "To'xtatish", 'Yopish', 'Tiklash', 'Bepul', 'Pullik', "O'chirish"]) {
    assert.equal(html.includes(word), true, word);
  }
  assert.equal(html.includes('998995700913'), false);
  assert.equal(login.includes('998995700913'), false);
  assert.equal(login.includes('type="password"'), true);
});

test('wrong owner password is rejected', async () => {
  const service = new PlatformGateService({} as never);
  const ok = await service.checkLogin('+998995700913', 'not-the-password', '203.0.113.10');
  assert.equal(ok, false);
});

test('missing section flags stay open', () => {
  assert.equal(normalizeSections({}).chat, true);
  assert.equal(normalizeSections({ chat: false }).chat, false);
  assert.equal(otpPurposeAllowed('register', { ...allSectionsOn(), register: false }), false);
  assert.equal(otpPurposeAllowed('login', { ...allSectionsOn(), register: false }), true);
});
