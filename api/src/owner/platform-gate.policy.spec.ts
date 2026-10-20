import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderOwnerPage } from './owner.page';
import { PlatformGateService } from './platform-gate.service';
import { isSessionCurrent } from '../common/session.util';
import {
  AI_PAYMENT_NOTICE,
  OTP_PAYMENT_NOTICE,
  advanceStatus,
  allSectionsOn,
  claimDecision,
  decideAccess,
  decommissionPlan,
  defaultSnapshot,
  emptyHolds,
  feedStatus,
  foldProviderStatus,
  meter,
  normalizeSections,
  otpPurposeAllowed,
  parseMoney,
  paymentHoldForPrice,
  reduceProviderEvent,
  signWebhook,
  som,
  spend,
  webhookSignatureOk,
  webhookTimestampFresh,
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

test('a closed panel leaves ordinary reads open and stops staff', () => {
  assert.equal(decideAccess({ ...live, state: 'removed', path: '/api/stats/counts' }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'paused', path: '/api/jobs' }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'off', path: '/uploads/public/a.jpg' }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'removed', role: 'worker', path: '/api/jobs' }).allow, true);
  const hidden = decideAccess({ ...live, state: 'removed', role: 'admin', path: '/api/jobs' });
  assert.equal(hidden.allow, false);
  if (!hidden.allow) assert.equal(hidden.status, 404);
  const paused = decideAccess({ ...live, state: 'paused', role: 'super_admin', path: '/api/admin/users' });
  assert.equal(paused.allow, false);
  if (!paused.allow) assert.equal(paused.status, 503);
  assert.equal(
    decideAccess({ ...live, state: 'off', path: '/api/auth/super-admin/login', method: 'POST' }).allow,
    false,
  );
  assert.equal(decideAccess({ ...live, state: 'removed', path: OWNER_PATH }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'removed', path: '/api/gate' }).allow, true);
  assert.equal(decideAccess({ ...live, state: 'removed', path: '/api/health' }).allow, true);
  assert.equal(
    decideAccess({ ...live, state: 'paused', role: 'admin', path: '/api/auth/logout', method: 'POST' }).allow,
    true,
  );
});

test('public section flags do not close ordinary reads', () => {
  const sections: GateSections = { ...allSectionsOn(), workers: false, chat: false, jobs: false };
  assert.equal(decideAccess({ ...live, sections, path: '/api/users' }).allow, true);
  assert.equal(decideAccess({ ...live, sections, path: '/api/chat-messages' }).allow, true);
  assert.equal(decideAccess({ ...live, sections, path: '/api/jobs/abc', method: 'POST' }).allow, true);
  assert.equal(decideAccess({ ...live, sections, path: '/api/auth/login', method: 'POST' }).allow, true);
});

test('an unpaid panel stops staff and leaves payment and workers', () => {
  assert.equal(decideAccess({ ...live, paidLock: true, role: 'admin', path: '/api/jobs' }).allow, false);
  assert.equal(decideAccess({ ...live, paidLock: true, role: 'worker', path: '/api/jobs' }).allow, true);
  assert.equal(
    decideAccess({ ...live, paidLock: true, role: 'super_admin', path: '/api/admin/subscription/status' }).allow,
    true,
  );
  assert.equal(
    decideAccess({ ...live, paidLock: true, role: 'super_admin', path: '/api/admin/subscription/pay', method: 'POST' }).allow,
    true,
  );
  assert.equal(
    decideAccess({ ...live, paidLock: true, path: '/api/auth/super-admin/login', method: 'POST' }).allow,
    false,
  );
});

test('a send is free at price zero and stops when the balance is short', () => {
  assert.deepEqual(spend(1000, 0), { ok: true, next: 1000 });
  assert.deepEqual(spend(500, 200), { ok: true, next: 300 });
  assert.deepEqual(spend(100, 200), { ok: false, next: 100 });
  assert.equal(som(57880), "57 880 so'm");
  assert.deepEqual(parseMoney('57 880'), { ok: true, value: 57880 });
  assert.equal(parseMoney('').ok, false);
  assert.equal(parseMoney('-5').ok, false);
  assert.equal(parseMoney('100000001').ok, false);
  assert.equal(meter(0, 100).tone, 'due');
  assert.equal(meter(2000, 100).tone, 'low');
  assert.equal(meter(2100, 100).tone, 'ok');
  assert.equal(meter(500, 0).tone, 'free');
  assert.equal(feedStatus({ detail: 'SMS ketmadi. OTP qoldig‘i yetarli emas.' }), 'short');
  assert.equal(feedStatus({ status: 'sent', detail: 'eski' }), 'sent');
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
  assert.equal(html.includes('OTP qoldiq'), true);
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

test('lockdown blocks ordinary calls and leaves the owner path', () => {
  const holds = { ...emptyHolds(), lockdown: true };
  assert.equal(decideAccess({ ...live, holds, path: '/api/auth/send-otp', method: 'POST' }).allow, false);
  assert.equal(decideAccess({ ...live, holds, path: '/api/ai/employer/match', method: 'POST' }).allow, false);
  assert.equal(decideAccess({ ...live, holds, role: 'super_admin', path: '/api/admin/users' }).allow, false);
  assert.equal(decideAccess({ ...live, holds, path: OWNER_PATH, method: 'POST' }).allow, true);
  assert.equal(decideAccess({ ...live, holds, path: '/api/gate' }).allow, true);
  assert.equal(decideAccess({ ...live, holds, path: '/api/sms/hook', method: 'POST' }).allow, true);
  assert.equal(decideAccess({ ...live, holds, path: '/api/auth/logout', method: 'POST' }).allow, true);
});

test('maintenance blocks writes and leaves reads and the staff pause alone', () => {
  const holds = { ...emptyHolds(), maintenance: true };
  assert.equal(decideAccess({ ...live, holds, path: '/api/jobs', method: 'GET' }).allow, true);
  assert.equal(decideAccess({ ...live, holds, path: '/api/jobs', method: 'POST' }).allow, false);
  assert.equal(decideAccess({ ...live, path: '/api/jobs', role: 'worker' }).allow, true);
});

test('a payment hold stops the meter until the price is covered', () => {
  const holds = { ...emptyHolds(), otpPayment: true, aiPayment: true };
  assert.deepEqual(claimDecision({ kind: 'otp', holds, price: 100, credit: 5000 }), { send: false, reason: 'payment' });
  assert.deepEqual(claimDecision({ kind: 'ai', holds, price: 100, credit: 5000 }), { send: false, reason: 'payment' });
  assert.equal(claimDecision({ kind: 'otp', holds, price: 0, credit: 0 }).send, true);
  assert.equal(claimDecision({ kind: 'otp', holds: emptyHolds(), price: 200, credit: 100 }).reason, 'short');
  assert.equal(paymentHoldForPrice(200, 100), true);
  assert.equal(paymentHoldForPrice(0, 0), false);
  assert.equal(paymentHoldForPrice(100, 100), false);
  assert.equal(OTP_PAYMENT_NOTICE.includes('OTP/SMS'), true);
  assert.equal(AI_PAYMENT_NOTICE.includes('Sun'), true);
});

test('provider events do not walk backwards or refund twice', () => {
  assert.equal(foldProviderStatus('pending'), 'accepted');
  assert.equal(advanceStatus('delivered', 'sent'), 'delivered');
  assert.equal(advanceStatus('failed', 'delivered'), 'failed');
  assert.equal(advanceStatus('sent', 'verified'), 'verified');
  const first = reduceProviderEvent({ status: 'sent', refunded: false, seen: ['accepted', 'sent'], incoming: 'failed' });
  assert.equal(first.status, 'failed');
  assert.equal(first.refund, true);
  const again = reduceProviderEvent({ status: 'failed', refunded: true, seen: first.seen, incoming: 'failed' });
  assert.equal(again.duplicate, true);
  assert.equal(again.refund, false);
  const late = reduceProviderEvent({ status: 'delivered', refunded: false, seen: ['delivered'], incoming: 'sent' });
  assert.equal(late.status, 'delivered');
  assert.equal(late.refund, false);
});

test('a forged or stale webhook signature is rejected', () => {
  const body = '{"sms_id":1,"status":"delivered"}';
  const stamp = '1700000000';
  const good = signWebhook('whsec_test', stamp, body);
  assert.equal(webhookSignatureOk('whsec_test', stamp, body, good), true);
  assert.equal(webhookSignatureOk('whsec_test', stamp, body, good.replace('a', 'b')), false);
  assert.equal(webhookSignatureOk('', stamp, body, good), false);
  assert.equal(webhookSignatureOk('whsec_test', stamp, body + ' ', good), false);
  assert.equal(webhookTimestampFresh(stamp, 1700000100), true);
  assert.equal(webhookTimestampFresh(stamp, 1700000401), false);
  assert.equal(webhookTimestampFresh('nope', 1700000000), false);
});

test('a cut session is expired and a dry-run plan deletes nothing', () => {
  const cut = new Date('2026-10-20T09:00:00Z');
  assert.equal(isSessionCurrent(Math.floor(cut.getTime() / 1000) - 10, cut), false);
  assert.equal(isSessionCurrent(Math.floor(cut.getTime() / 1000) + 10, cut), true);
  const plan = decommissionPlan({ cwd: '', remote: '', branch: '' });
  const text = JSON.stringify(plan);
  assert.equal(text.includes('aniqlanmadi'), true);
  assert.equal(text.includes('o‘chirilmaydi'), true);
  assert.equal(text.includes('rm '), false);
  assert.equal(feedStatus({ status: 'delivered' }), 'delivered');
});

test('the control page shows service holds and does not invent a provider balance', () => {
  const html = renderOwnerPage({ authed: true, snap: defaultSnapshot() });
  for (const word of ['To‘liq to‘xtatish', 'Yetkazildi', 'Sinxron', 'hali yo‘q', 'O‘chirish rejasi']) {
    assert.equal(html.includes(word), true, word);
  }
  const service = new PlatformGateService({} as never);
  assert.equal(service.valid(service.sign()), true);
  assert.equal(service.valid('not-a-session'), false);
});
