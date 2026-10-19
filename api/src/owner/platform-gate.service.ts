import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { rememberGate } from './platform-gate.cache';
import {
  decideAccess,
  defaultSnapshot,
  feedPurpose,
  feedStatus,
  money,
  normalizeBilling,
  normalizeSections,
  normalizeState,
  parseMoney,
  type AccessDecision,
  type GateSnapshot,
  type SectionKey,
} from './platform-gate.policy';
import { isOwnerPhone, OWNER_PASSWORD_HASH } from './owner.constants';

type GateRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: { authorization?: string | string[] };
  ip?: string;
};

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return 'dev-secret';
}

export type OwnerFeedItem = {
  at: string;
  phone: string;
  code: string;
  detail: string;
  purpose: string;
  status: string;
};

export type LedgerItem = {
  at: string;
  kind: string;
  actor: string;
  amountSom: number;
  balanceSom: number;
  reason: string;
};

export type PayPrompt = {
  kind: 'otp' | 'ai';
  title: string;
  price: number;
  credit: number;
  need: number;
};

const FEED_KEEP = 200;
const LEDGER_KEEP = 300;

@Injectable()
export class PlatformGateService {
  private cached: { at: number; snap: GateSnapshot } | null = null;
  private readonly loginHits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async snapshot(): Promise<GateSnapshot> {
    if (this.cached && Date.now() - this.cached.at < 1000) {
      rememberGate(this.cached.snap);
      return this.cached.snap;
    }
    const snap = await this.read();
    this.cached = { at: Date.now(), snap };
    rememberGate(snap);
    return snap;
  }

  async decide(req: GateRequest, paidLock = false): Promise<AccessDecision> {
    const snap = await this.snapshot();
    const header = req.headers?.authorization;
    const token = Array.isArray(header) ? header[0] : header || '';
    const identity = this.readBearer(token);
    return decideAccess({
      path: (req.originalUrl || req.url || '/').split('?')[0],
      method: req.method || 'GET',
      role: identity.role,
      userId: identity.userId,
      state: snap.state,
      sections: snap.sections,
      paidLock,
    });
  }

  sign(): string {
    return jwt.sign({ kind: 'gate', sub: 'g' }, jwtSecret(), { expiresIn: '12h' });
  }

  valid(token: string): boolean {
    if (!token) return false;
    try {
      const payload = jwt.verify(token, jwtSecret()) as { kind?: string };
      return payload.kind === 'gate';
    } catch {
      return false;
    }
  }

  async checkLogin(phone: string, password: string, ip: string): Promise<boolean> {
    this.hit(ip);
    const phoneOk = isOwnerPhone(phone);
    const passwordOk = await bcrypt.compare(password || ' ', OWNER_PASSWORD_HASH);
    return phoneOk && passwordOk;
  }

  async apply(body: { action?: string; value?: string; confirm?: string; name?: string }): Promise<PayPrompt | null> {
    const action = String(body.action || '');
    const current = await this.readFresh();
    if (action === 'presence') {
      const value = normalizeState(body.value);
      if (value === 'live' && body.value !== 'live') return null;
      if ((String(body.value) === 'removed' || String(body.value) === 'off') && String(body.confirm) !== 'yes') return null;
      if (!['live', 'paused', 'off', 'removed'].includes(String(body.value))) return null;
      await this.patch({ state: value });
      return null;
    }
    if (action === 'restore') {
      await this.patch({ state: 'live', sections: normalizeSections({}) });
      return null;
    }
    if (action === 'billing') {
      if (body.value !== 'free' && body.value !== 'paid') return null;
      await this.patch({ billing: body.value });
      return null;
    }
    if (action === 'section') {
      const name = String(body.name || '') as SectionKey;
      if (name !== 'admin' && name !== 'superAdmin') return null;
      if (body.value !== 'on' && body.value !== 'off') return null;
      const sections = { ...current.sections, [name]: body.value === 'on' };
      await this.patch({ sections });
      return null;
    }
    if (action === 'topup') {
      const parsed = parseMoney(body.value);
      if (!parsed.ok || parsed.value <= 0) throw new HttpException("Summani kiriting.", 400);
      const kind = body.name === 'ai' ? 'ai' : 'otp';
      await this.adjustCredit(kind, parsed.value, 'add', 'owner', "To'lov qabul qilindi");
      return null;
    }
    if (action === 'money') {
      const parsed = parseMoney(body.value);
      if (!parsed.ok) throw new HttpException(parsed.error, 400);
      const amount = parsed.value;
      const name = String(body.name || '');
      if (name === 'staff') {
        await this.patch({ staffPriceSom: amount });
        await this.prisma.platformSubscription.upsert({
          where: { id: 'platform' },
          create: { id: 'platform', status: 'active', priceSom: amount, priceOverride: amount },
          update: { priceSom: amount, priceOverride: amount },
        }).catch(() => undefined);
        return null;
      }
      if (name === 'otpCredit' || name === 'aiCredit') {
        const kind = name === 'otpCredit' ? 'otp' : 'ai';
        const before = kind === 'otp' ? current.otpCreditSom : current.aiCreditSom;
        await this.adjustCredit(kind, amount - before, 'set', 'owner', 'Qoldiq yangilandi', amount);
        return null;
      }
      if (name !== 'otpPrice' && name !== 'aiPrice') return null;
      if (name === 'otpPrice') await this.patch({ otpPriceSom: amount });
      else await this.patch({ aiPriceSom: amount });
      const credit = name === 'otpPrice' ? current.otpCreditSom : current.aiCreditSom;
      if (amount > 0 && credit < amount) {
        return {
          kind: name === 'otpPrice' ? 'otp' : 'ai',
          title: name === 'otpPrice'
            ? "OTP to'lovi yaqin: to'lovni amalga oshiring"
            : "Sun'iy intellekt to'lovi yaqin: to'lovni amalga oshiring",
          price: amount,
          credit,
          need: amount - credit,
        };
      }
      return null;
    }
    return null;
  }

  async listFeed(): Promise<OwnerFeedItem[]> {
    try {
      const rows = await this.prisma.ownerFeed.findMany({
        orderBy: { createdAt: 'desc' },
        take: FEED_KEEP,
      });
      return rows.map((row) => ({
        at: row.createdAt.toISOString(),
        phone: row.phone,
        code: row.code,
        detail: row.detail,
        purpose: feedPurpose(row),
        status: feedStatus(row),
      }));
    } catch {
      return [];
    }
  }

  async listLedger(): Promise<LedgerItem[]> {
    try {
      const rows = await this.prisma.creditLedger.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      return rows.map((row) => ({
        at: row.createdAt.toISOString(),
        kind: row.kind,
        actor: row.actor,
        amountSom: row.amountSom,
        balanceSom: row.balanceSom,
        reason: row.reason,
      }));
    } catch {
      return [];
    }
  }

  async subscriptionBrief(): Promise<{ until: string | null; days: number | null }> {
    try {
      const row = await this.prisma.platformSubscription.findUnique({ where: { id: 'platform' } });
      const until = row?.paidUntil ?? row?.freeUntil ?? null;
      if (!until) return { until: null, days: null };
      const days = Math.ceil((until.getTime() - Date.now()) / 86_400_000);
      return { until: until.toISOString(), days };
    } catch {
      return { until: null, days: null };
    }
  }

  /**
   * OTP or AI send. Price 0 always allows the send. A short balance keeps the
   * code in the feed and skips the outside provider. The debit is one locked
   * update, so two sends cannot spend the same sum.
   */
  async claimSend(kind: 'otp' | 'ai', meta: { phone?: string; code?: string; purpose?: string }): Promise<{ send: boolean; feedId?: string }> {
    const phone = (meta.phone || '').slice(0, 32);
    const code = (meta.code || '').slice(0, 12);
    const purpose = (meta.purpose || (kind === 'ai' ? 'ai' : 'login')).slice(0, 24);
    const result = await this.locked(async (tx) => {
      const row = await tx.platformGate.findUnique({ where: { id: 'gate' } });
      if (!row) return { send: false as const };
      const price = kind === 'otp' ? money(row.otpPriceSom) : money(row.aiPriceSom);
      const credit = kind === 'otp' ? money(row.otpCreditSom) : money(row.aiCreditSom);
      if (price > 0 && credit < price) {
        const feedId = kind === 'otp'
          ? await this.noteTx(tx, phone, code, 'Balans yetmadi', purpose, 'short')
          : undefined;
        return { send: false as const, feedId };
      }
      let next = credit;
      if (price > 0) {
        next = credit - price;
        await tx.platformGate.update({
          where: { id: 'gate' },
          data: kind === 'otp' ? { otpCreditSom: next } : { aiCreditSom: next },
        });
        await this.journalTx(tx, kind, 'system', -price, next, kind === 'otp' ? 'SMS uchun yechildi' : "So'rov uchun yechildi");
      }
      const feedId = kind === 'otp' && purpose !== 'notice'
        ? await this.noteTx(tx, phone, code, `SMS yuborilmoqda (${purpose})`, purpose, 'sending')
        : undefined;
      return { send: true as const, feedId };
    });
    this.cached = null;
    return result;
  }

  async markSendDelivered(feedId?: string): Promise<void> {
    if (!feedId) return;
    await this.prisma.ownerFeed.update({
      where: { id: feedId },
      data: { status: 'sent', detail: 'SMS yuborildi' },
    }).catch(() => undefined);
  }

  async markSendFailed(kind: 'otp' | 'ai', detail: string, feedId?: string): Promise<void> {
    await this.locked(async (tx) => {
      const row = await tx.platformGate.findUnique({ where: { id: 'gate' } });
      const price = row ? (kind === 'otp' ? money(row.otpPriceSom) : money(row.aiPriceSom)) : 0;
      if (row && price > 0) {
        const credit = kind === 'otp' ? money(row.otpCreditSom) : money(row.aiCreditSom);
        const next = Math.min(100_000_000, credit + price);
        await tx.platformGate.update({
          where: { id: 'gate' },
          data: kind === 'otp' ? { otpCreditSom: next } : { aiCreditSom: next },
        });
        await this.journalTx(tx, kind, 'system', price, next, 'Yuborilmadi, qaytarildi');
      }
      const text = detail.slice(0, 180);
      if (feedId) {
        await tx.ownerFeed.update({
          where: { id: feedId },
          data: { status: 'error', detail: text },
        }).catch(() => undefined);
      } else if (kind === 'otp') {
        await this.noteTx(tx, '', '', text, '', 'error');
      }
    });
    this.cached = null;
  }

  async rememberSmsBalance(balance: number | null | undefined): Promise<void> {
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return;
    await this.patch({ smsBalance: Math.max(0, Math.floor(balance)) });
  }

  private hit(ip: string) {
    const now = Date.now();
    const key = ip || 'unknown';
    const row = this.loginHits.get(key);
    if (!row || now >= row.resetAt) {
      this.loginHits.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return;
    }
    row.count += 1;
    if (row.count > 8) {
      throw new HttpException('Juda koʻp urinish. Birozdan keyin qayta urinib koʻring.', 429);
    }
  }

  private readBearer(header: string): { role: string | null; userId: string | null } {
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return { role: null, userId: null };
    try {
      const payload = jwt.verify(token, jwtSecret()) as { role?: string; sub?: string; kind?: string };
      if (payload.kind === 'gate') return { role: null, userId: null };
      return {
        role: typeof payload.role === 'string' ? payload.role : null,
        userId: typeof payload.sub === 'string' ? payload.sub : null,
      };
    } catch {
      return { role: null, userId: null };
    }
  }

  private async read(): Promise<GateSnapshot> {
    try {
      const row = await this.prisma.platformGate.findUnique({ where: { id: 'gate' } });
      if (!row) {
        const created = await this.prisma.platformGate.create({
          data: {
            id: 'gate',
            state: 'live',
            billing: 'paid',
            sections: {},
            staffPriceSom: 250000,
            otpPriceSom: 0,
            otpCreditSom: 0,
            aiPriceSom: 0,
            aiCreditSom: 0,
          },
        });
        return this.toSnap(created);
      }
      return this.toSnap(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2021' || err.code === 'P2022')) {
        return defaultSnapshot();
      }
      const message = err instanceof Error ? err.message : '';
      if (message.includes('platform_gate') || message.includes('does not exist')) return defaultSnapshot();
      return defaultSnapshot();
    }
  }

  private async readFresh(): Promise<GateSnapshot> {
    this.cached = null;
    return this.read();
  }

  private toSnap(row: {
    state: string;
    billing: string;
    sections: unknown;
    staffPriceSom?: number;
    otpPriceSom?: number;
    otpCreditSom?: number;
    aiPriceSom?: number;
    aiCreditSom?: number;
    smsBalance?: number | null;
  }): GateSnapshot {
    return {
      state: normalizeState(row.state),
      billing: normalizeBilling(row.billing),
      sections: normalizeSections(row.sections),
      staffPriceSom: money(row.staffPriceSom ?? 250000),
      otpPriceSom: money(row.otpPriceSom ?? 0),
      otpCreditSom: money(row.otpCreditSom ?? 0),
      aiPriceSom: money(row.aiPriceSom ?? 0),
      aiCreditSom: money(row.aiCreditSom ?? 0),
      smsBalance: typeof row.smsBalance === 'number' ? row.smsBalance : null,
    };
  }

  private async patch(data: Prisma.PlatformGateUpdateInput): Promise<void> {
    await this.ensureRow();
    await this.prisma.platformGate.update({ where: { id: 'gate' }, data });
    this.cached = null;
    rememberGate(await this.snapshot());
  }

  private async ensureRow(): Promise<void> {
    const existing = await this.prisma.platformGate.findUnique({ where: { id: 'gate' } });
    if (existing) return;
    await this.prisma.platformGate.create({
      data: {
        id: 'gate',
        state: 'live',
        billing: 'paid',
        sections: {},
        staffPriceSom: 250000,
        otpPriceSom: 0,
        otpCreditSom: 0,
        aiPriceSom: 0,
        aiCreditSom: 0,
      },
    }).catch(() => undefined);
  }

  private async locked<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    await this.ensureRow();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM platform_gate WHERE id = 'gate' FOR UPDATE`;
      return fn(tx);
    });
  }

  private async adjustCredit(
    kind: 'otp' | 'ai',
    delta: number,
    mode: 'add' | 'set',
    actor: 'owner' | 'system',
    reason: string,
    absolute?: number,
  ): Promise<void> {
    await this.locked(async (tx) => {
      const row = await tx.platformGate.findUnique({ where: { id: 'gate' } });
      if (!row) return;
      const before = kind === 'otp' ? money(row.otpCreditSom) : money(row.aiCreditSom);
      const next = mode === 'set' ? (absolute ?? before) : before + delta;
      if (next < 0 || next > 100_000_000) throw new HttpException("Juda katta son.", 400);
      if (next === before) return;
      await tx.platformGate.update({
        where: { id: 'gate' },
        data: kind === 'otp' ? { otpCreditSom: next } : { aiCreditSom: next },
      });
      await this.journalTx(tx, kind, actor, next - before, next, reason);
    });
    this.cached = null;
  }

  private async noteTx(
    tx: Prisma.TransactionClient,
    phone: string,
    code: string,
    detail: string,
    purpose: string,
    status: string,
  ): Promise<string> {
    const row = await tx.ownerFeed.create({
      data: {
        phone: phone.slice(0, 32),
        code: code.slice(0, 12),
        detail: detail.slice(0, 180),
        purpose: purpose.slice(0, 24),
        status: status.slice(0, 16),
      },
    });
    const stale = await tx.ownerFeed.findMany({
      orderBy: { createdAt: 'desc' },
      skip: FEED_KEEP,
      select: { id: true },
    });
    if (stale.length) {
      await tx.ownerFeed.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
    }
    return row.id;
  }

  private async journalTx(
    tx: Prisma.TransactionClient,
    kind: 'otp' | 'ai',
    actor: 'owner' | 'system',
    amountSom: number,
    balanceSom: number,
    reason: string,
  ): Promise<void> {
    if (!amountSom) return;
    await tx.creditLedger.create({
      data: {
        kind,
        actor,
        amountSom,
        balanceSom,
        reason: reason.slice(0, 180),
      },
    });
    const stale = await tx.creditLedger.findMany({
      orderBy: { createdAt: 'desc' },
      skip: LEDGER_KEEP,
      select: { id: true },
    });
    if (stale.length) {
      await tx.creditLedger.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
    }
  }
}
