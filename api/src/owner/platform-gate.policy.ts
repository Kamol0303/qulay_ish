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
};

export type AccessDecision =
  | { allow: true }
  | { allow: false; status: number; message: string };

const ALLOWED = new Set(['/api/health', '/api/gate']);

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

export type FeedStatus = 'sending' | 'sent' | 'error' | 'short';

export function feedStatus(row: { status?: string; detail?: string }): FeedStatus | '' {
  if (row.status === 'sending' || row.status === 'sent' || row.status === 'error' || row.status === 'short') {
    return row.status;
  }
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

export function decideAccess(input: {
  path: string;
  method: string;
  role: string | null;
  userId: string | null;
  state: GateState;
  sections: GateSections;
  paidLock?: boolean;
}): AccessDecision {
  const path = (input.path || '/').split('?')[0];
  const staff = staffRole(input.role) || staffApi(path);
  const held = input.state !== 'live';

  if (path === OWNER_PATH || path.startsWith(`${OWNER_PATH}/`)) return { allow: true };
  if (ALLOWED.has(path)) return { allow: true };
  if (path === '/api/stats/counts') return { allow: true };
  if (sessionPath(path)) return { allow: true };

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
