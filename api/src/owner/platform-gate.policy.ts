import { createHmac, timingSafeEqual } from 'crypto';
import { OWNER_PATH } from './owner.constants';

export const SECTION_KEYS = [
  'register',
  'login',
  'workers',
  'jobs',
  'chat',
  'calls',
  'verification',
  'admin',
  'superAdmin',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type GateSections = Record<SectionKey, boolean>;
export type GateState = 'live' | 'paused' | 'off' | 'removed';
export type GateBilling = 'free' | 'paid';

export const HOLD_KEYS = [
  'registrations',
  'otp',
  'ai',
  'billing',
  'maintenance',
  'lockdown',
  'otpPayment',
  'aiPayment',
] as const;

export type HoldKey = (typeof HOLD_KEYS)[number];
export type ServiceHolds = Record<HoldKey, boolean>;

export type GateSnapshot = {
  state: GateState;
  billing: GateBilling;
  sections: GateSections;
  staffPriceSom: number;
  otpPriceSom: number;
  otpCreditSom: number;
  aiPriceSom: number;
  aiCreditSom: number;
  smsBalance: number | null;
  holds: ServiceHolds;
  smsSyncedAt: string | null;
  smsSyncError: string;
  sessionsCut: string | null;
  providerConfigured: boolean;
  webhookConfigured: boolean;
};

export const AI_PAYMENT_NOTICE =
  "Sun'iy intellekt xizmatidan foydalanish hozircha vaqtincha to‘xtatildi. Xizmatdan foydalanishni davom ettirish uchun belgilangan to‘lovni amalga oshiring. To‘lov tasdiqlangach, xizmat egasining ruxsati bilan qayta faollashtiriladi. Shundan so‘ng xizmat odatdagidek ishlashda davom etadi.";

export const OTP_PAYMENT_NOTICE =
  "OTP/SMS xizmati hozircha vaqtincha to‘xtatildi. Xizmatdan foydalanishni davom ettirish uchun belgilangan to‘lovni amalga oshiring. To‘lov tasdiqlanib, egasi ruxsat berganidan keyin xizmat qayta ishga tushiriladi. Shundan so‘ng xizmat odatdagidek ishlashda davom etadi.";

export const OTP_PAUSE_NOTICE = "OTP/SMS xizmati vaqtincha to‘xtatilgan.";
export const AI_PAUSE_NOTICE = "Sun'iy intellekt xizmati vaqtincha to‘xtatilgan.";
export const REGISTER_PAUSE_NOTICE = "Yangi ro‘yxatdan o‘tish vaqtincha to‘xtatilgan.";
export const BILLING_PAUSE_NOTICE = "Yangi to‘lovlar vaqtincha to‘xtatilgan.";
export const MAINTENANCE_NOTICE = "Sayt vaqtincha texnik ishda. Iltimos, birozdan keyin qayta kiring.";
export const LOCKDOWN_NOTICE =
  "Xavfsizlik sababli xizmat vaqtincha to‘xtatildi. Iltimos, keyinroq qayta urinib ko‘ring.";

export const LOCK_ON_PHRASE = 'YOPISH';
export const LOCK_OFF_PHRASE = 'OCHISH';

export type AccessDecision =
  | { allow: true }
  | { allow: false; status: number; message: string };

const ALLOWED = new Set(['/api/health', '/api/gate']);

export function emptyHolds(): ServiceHolds {
  return {
    registrations: false,
    otp: false,
    ai: false,
    billing: false,
    maintenance: false,
    lockdown: false,
    otpPayment: false,
    aiPayment: false,
  };
}

export function normalizeHolds(value: unknown): ServiceHolds {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const holds = emptyHolds();
  for (const key of HOLD_KEYS) {
    if (src[key] === true) holds[key] = true;
  }
  return holds;
}

export function allSectionsOn(): GateSections {
  return {
    register: true,
    login: true,
    workers: true,
    jobs: true,
    chat: true,
    calls: true,
    verification: true,
    admin: true,
    superAdmin: true,
  };
}

export function defaultSnapshot(): GateSnapshot {
  return {
    state: 'live',
    billing: 'paid',
    sections: allSectionsOn(),
    staffPriceSom: 250000,
    otpPriceSom: 0,
    otpCreditSom: 0,
    aiPriceSom: 0,
    aiCreditSom: 0,
    smsBalance: null,
    holds: emptyHolds(),
    smsSyncedAt: null,
    smsSyncError: '',
    sessionsCut: null,
    providerConfigured: false,
    webhookConfigured: false,
  };
}

export function money(value: unknown): number {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100_000_000, Math.floor(n));
}

const MONEY_CAP = 100_000_000;

export type MoneyResult = { ok: true; value: number } | { ok: false; error: string };

/** Form money. Empty, negative, and oversized values are rejected. */
export function parseMoney(value: unknown): MoneyResult {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: false, error: "Qiymat bo'sh." };
  if (raw.startsWith('-')) return { ok: false, error: "Manfiy son bo'lmaydi." };
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return { ok: false, error: "Son kiriting." };
  const n = Number(digits);
  if (!Number.isFinite(n) || n > MONEY_CAP) return { ok: false, error: "Juda katta son." };
  return { ok: true, value: Math.floor(n) };
}

/** 57880 -> "57 880 so'm" */
export function som(value: number): string {
  const n = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  const grouped = n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${grouped} so'm`;
}

export type MeterTone = 'free' | 'ok' | 'low' | 'due';

/** Price 0 is free. Twenty sends or fewer is a warning. Below one send, payment is due. */
export function meter(credit: number, price: number): { tone: MeterTone; left: number | null; pct: number } {
  const c = Math.max(0, Math.floor(credit));
  const p = Math.max(0, Math.floor(price));
  if (p === 0) return { tone: 'free', left: null, pct: 100 };
  const left = Math.floor(c / p);
  if (left < 1) return { tone: 'due', left: 0, pct: 0 };
  if (left <= 20) return { tone: 'low', left, pct: Math.max(8, Math.round((left / 20) * 100)) };
  return { tone: 'ok', left, pct: 100 };
}

export const FEED_STATUSES = [
  'created',
  'queued',
  'sending',
  'accepted',
  'sent',
  'delivered',
  'failed',
  'pending',
  'verified',
  'expired',
  'cancelled',
  'refunded',
  'error',
  'unknown',
  'short',
  'blocked',
] as const;

export type FeedStatus = (typeof FEED_STATUSES)[number];

const FEED_STATUS_SET = new Set<string>(FEED_STATUSES);

export function feedStatus(row: { status?: string; detail?: string }): FeedStatus | '' {
  if (row.status && FEED_STATUS_SET.has(row.status)) return row.status as FeedStatus;
  const detail = (row.detail || '').toLowerCase();
  if (detail.includes('yetarli') || detail.includes('balans')) return 'short';
  if (detail.includes('ketmadi') || detail.includes('javob bermadi') || detail.includes('xato')) return 'error';
  if (detail.includes('yuborildi')) return 'sent';
  if (detail.includes('yuborilmoqda')) return 'sending';
  return '';
}

export function feedPurpose(row: { purpose?: string; detail?: string }): string {
  if (row.purpose) return row.purpose;
  const match = /\((login|register|reset|payment|notice|ai)\)/i.exec(row.detail || '');
  return match ? match[1].toLowerCase() : '';
}

/** Price 0 means the send is free. Otherwise the credit must cover one send. */
export function spend(credit: number, price: number): { ok: boolean; next: number } {
  const c = Math.max(0, Math.floor(credit));
  const p = Math.max(0, Math.floor(price));
  if (p === 0) return { ok: true, next: c };
  if (c < p) return { ok: false, next: c };
  return { ok: true, next: c - p };
}

export function normalizeState(value: unknown): GateState {
  if (value === 'paused' || value === 'off' || value === 'removed' || value === 'live') return value;
  return 'live';
}

export function normalizeBilling(value: unknown): GateBilling {
  return value === 'free' ? 'free' : 'paid';
}

export function normalizeSections(value: unknown): GateSections {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sections = allSectionsOn();
  for (const key of SECTION_KEYS) {
    if (src[key] === false) sections[key] = false;
  }
  return sections;
}

export function otpPurposeAllowed(purpose: string, sections: GateSections): boolean {
  if (purpose === 'register') return sections.register;
  return sections.login;
}

function sessionPath(path: string): boolean {
  return path === '/api/auth/me' || path === '/api/auth/logout' || path === '/api/auth/refresh';
}

function staffRole(role: string | null): boolean {
  return role === 'admin' || role === 'super_admin';
}

function staffApi(path: string): boolean {
  return path.startsWith('/api/admin/') || path === '/api/auth/super-admin/login';
}

const PAY_PATHS = new Set([
  '/api/admin/subscription/status',
  '/api/admin/subscription/pay',
  '/api/admin/subscription/paid',
  '/api/admin/subscription/verify-otp',
]);

function closed(message: string, status = 403): AccessDecision {
  return { allow: false, status, message };
}

export type ClaimReason = 'ok' | 'paused' | 'payment' | 'short' | 'lockdown';

/** Server-side meter. A payment hold stays until the owner resumes it, even if credit later covers the price. Price 0 ignores the payment hold. */
export function claimDecision(input: {
  kind: 'otp' | 'ai';
  holds: ServiceHolds;
  price: number;
  credit: number;
}): { send: boolean; reason: ClaimReason } {
  const holds = input.holds;
  const price = Math.max(0, Math.floor(input.price));
  const credit = Math.max(0, Math.floor(input.credit));
  if (holds.lockdown) return { send: false, reason: 'lockdown' };
  if (input.kind === 'otp' && holds.otp) return { send: false, reason: 'paused' };
  if (input.kind === 'ai' && holds.ai) return { send: false, reason: 'paused' };
  const payment = input.kind === 'otp' ? holds.otpPayment : holds.aiPayment;
  if (payment && price > 0) return { send: false, reason: 'payment' };
  if (price > 0 && credit < price) return { send: false, reason: 'short' };
  return { send: true, reason: 'ok' };
}

/** A new price requires payment only when it is above the verified credit. Price 0 is free. */
export function paymentHoldForPrice(price: number, credit: number): boolean {
  return price > 0 && credit < price;
}

export function publicNotice(holds: ServiceHolds): string {
  if (holds.lockdown) return LOCKDOWN_NOTICE;
  if (holds.maintenance) return MAINTENANCE_NOTICE;
  return '';
}

export function isStaffSection(name: string): boolean {
  return name === 'admin' || name === 'superAdmin';
}

const STATUS_RANK: Record<string, number> = {
  short: 5,
  created: 10,
  unknown: 15,
  queued: 20,
  sending: 30,
  accepted: 40,
  pending: 40,
  sent: 50,
  delivered: 70,
  error: 80,
  expired: 85,
  blocked: 90,
  failed: 90,
  cancelled: 90,
  refunded: 95,
  verified: 100,
};

export function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 0;
}

/** DevSMS pending means accepted, not delivered to the handset. */
export function foldProviderStatus(raw: string): FeedStatus {
  const value = raw.trim().toLowerCase();
  if (value === 'pending') return 'accepted';
  if (value === 'queued') return 'queued';
  if (value === 'sending' || value === 'sent_to_device') return 'sending';
  if (value === 'sent') return 'sent';
  if (value === 'delivered') return 'delivered';
  if (value === 'failed') return 'failed';
  if (value === 'blocked') return 'blocked';
  if (value === 'expired') return 'expired';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'refunded') return 'refunded';
  if (FEED_STATUS_SET.has(value)) return value as FeedStatus;
  return 'unknown';
}

const FORWARD_BLOCK = new Set(['delivered', 'failed', 'blocked', 'cancelled', 'refunded', 'verified']);

/** Do not walk a final provider status backwards. Verification may follow sent or delivered. */
export function advanceStatus(current: string, next: string): string {
  if (!next) return current || 'unknown';
  if (!current) return next;
  if (current === next) return current;
  if (current === 'verified') return 'verified';
  if (FORWARD_BLOCK.has(current) && next !== 'verified' && next !== 'refunded') return current;
  if (current === 'delivered' && next === 'failed') return current;
  if (current === 'failed' && next === 'delivered') return current;
  if (next === 'verified') return 'verified';
  if (next === 'expired' && current !== 'delivered') return 'expired';
  return statusRank(next) >= statusRank(current) ? next : current;
}

const REFUND_STATUSES = new Set(['failed', 'expired', 'cancelled', 'blocked']);

export function shouldRefund(status: string, refunded: boolean): boolean {
  return !refunded && REFUND_STATUSES.has(status);
}

export type ProviderReduction = {
  status: string;
  refund: boolean;
  duplicate: boolean;
  seen: string[];
};

export function reduceProviderEvent(input: {
  status: string;
  refunded: boolean;
  seen: string[];
  incoming: string;
}): ProviderReduction {
  const incoming = foldProviderStatus(input.incoming);
  const seen = input.seen.filter(Boolean);
  if (seen.includes(incoming)) {
    return { status: input.status, refund: false, duplicate: true, seen };
  }
  const status = advanceStatus(input.status, incoming);
  const nextSeen = seen.concat(incoming).slice(-20);
  return {
    status,
    refund: shouldRefund(status, input.refunded) && status !== input.status,
    duplicate: false,
    seen: nextSeen,
  };
}

export function signWebhook(secret: string, timestamp: string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

export function webhookTimestampFresh(timestamp: string, nowSec: number, skew = 300): boolean {
  if (!/^\d{9,12}$/.test(timestamp)) return false;
  const value = Number(timestamp);
  return Math.abs(nowSec - value) <= skew;
}

export function webhookSignatureOk(secret: string, timestamp: string, rawBody: string, given: string): boolean {
  if (!secret || !given) return false;
  const expected = signWebhook(secret, timestamp, rawBody);
  const left = Buffer.from(expected);
  const right = Buffer.from(given);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type AuditEvent = {
  at: string;
  actor: string;
  action: string;
  target: string;
  outcome: string;
  reason: string;
};

export function normalizeHistory(value: unknown): AuditEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-80).map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      at: String(row.at || ''),
      actor: String(row.actor || 'owner').slice(0, 24),
      action: String(row.action || '').slice(0, 40),
      target: String(row.target || '').slice(0, 40),
      outcome: String(row.outcome || '').slice(0, 24),
      reason: String(row.reason || '').slice(0, 180),
    };
  });
}

export type InventoryLine = { label: string; value: string };

/** Dry-run only. Script paths are labeled as written in the repo, not as a live probe. */
export function decommissionPlan(probed: { cwd: string; remote: string; branch: string }): {
  lines: InventoryLine[];
  notes: string[];
} {
  const cwd = probed.cwd.trim() || 'aniqlanmadi';
  const remote = probed.remote.trim() || 'aniqlanmadi';
  const branch = probed.branch.trim() || 'aniqlanmadi';
  return {
    lines: [
      { label: 'Shu mashinadagi papka', value: cwd },
      { label: 'Git remote', value: remote },
      { label: 'Git tarmoq', value: branch },
      { label: 'Skriptdagi joy', value: '/var/www/qulay-ish (deploy.sh)' },
      { label: 'Skriptdagi domen', value: 'ishliayol.uz' },
      { label: 'Skriptdagi IP', value: '185.203.237.57' },
      { label: 'Nginx root', value: '/var/www/qulay-ish/dist (nginx-config.conf)' },
      { label: 'API', value: '127.0.0.1:4000, pm2 qulay-ish-api' },
      { label: 'Baza', value: 'PostgreSQL. Ulanish api/.env da, bu yerda ko‘rsatilmaydi.' },
      { label: 'SMS', value: 'DevSMS. Token api/.env da.' },
      { label: 'Sun’iy intellekt', value: 'ANTHROPIC_API_KEY yoki OPENAI_API_KEY. Yo‘q bo‘lsa mock.' },
      { label: 'Yuklamalar', value: 'uploads/' },
      { label: 'Zaxira', value: '/root/qulay-backup (skript shu joyni qidiradi)' },
    ],
    notes: [
      'Bu ro‘yxat sinov. Hech qanday fayl, baza, domen yoki remote o‘chirilmaydi.',
      'Vaqtinchalik to‘xtatish, xizmatni o‘chirish, serverni yechish va butunlay o‘chirish bir xil amal emas.',
      'Git remote, production baza, domen va zaxira nusxa avtomatik o‘chirilmaydi.',
      'Doimiy o‘chirish alohida qo‘lda tartib. Bu sahifa uni bajarmaydi.',
      'Agar sahifa ochilmasa, serverdagi api/.env ni saqlang va redeploy skriptini shu serverda ishga tushiring. Egasi kirishi SMS ga bog‘liq emas.',
    ],
  };
}

export function decideAccess(input: {
  path: string;
  method: string;
  role: string | null;
  userId: string | null;
  state: GateState;
  sections: GateSections;
  paidLock?: boolean;
  holds?: ServiceHolds;
}): AccessDecision {
  const path = (input.path || '/').split('?')[0];
  const method = (input.method || 'GET').toUpperCase();
  const staff = staffRole(input.role) || staffApi(path);
  const held = input.state !== 'live';
  const holds = input.holds || emptyHolds();

  if (path === OWNER_PATH || path.startsWith(`${OWNER_PATH}/`)) return { allow: true };
  if (ALLOWED.has(path)) return { allow: true };
  if (path === '/api/sms/hook') return { allow: true };
  if (sessionPath(path)) return { allow: true };

  if (holds.lockdown) return closed(LOCKDOWN_NOTICE, 503);
  if (holds.maintenance && method !== 'GET' && method !== 'HEAD') return closed(MAINTENANCE_NOTICE, 503);

  if (path === '/api/stats/counts') return { allow: true };

  if (held && staff) {
    const status = input.state === 'removed' ? 404 : 503;
    return closed('Panel hozir yopiq.', status);
  }

  if (!held && input.role === 'admin' && !input.sections.admin) {
    return closed('Panel hozir yopiq.');
  }
  if (!held && (input.role === 'super_admin' || path === '/api/auth/super-admin/login') && !input.sections.superAdmin) {
    return closed('Panel hozir yopiq.');
  }
  if (!held && !input.sections.admin && (path.startsWith('/api/admin/users') || path.startsWith('/api/admin/export'))) {
    return closed('Panel hozir yopiq.');
  }
  if (!held && !input.sections.superAdmin && path.startsWith('/api/admin/subscription') && !PAY_PATHS.has(path)) {
    return closed('Panel hozir yopiq.');
  }

  if (input.paidLock && staff && !PAY_PATHS.has(path)) {
    return closed('Panel toʻxtatilgan.');
  }
  return { allow: true };
}
