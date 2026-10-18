import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { rememberGate } from './platform-gate.cache';
import {
  decideAccess,
  defaultSnapshot,
  money,
  normalizeBilling,
  normalizeSections,
  normalizeState,
  spend,
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

export type OwnerFeedItem = { at: string; phone: string; code: string; detail: string };

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

  async apply(body: { action?: string; value?: string; confirm?: string; name?: string }): Promise<void> {
    const action = String(body.action || '');
    const current = await this.readFresh();
    if (action === 'presence') {
      const value = normalizeState(body.value);
      if (value === 'live' && body.value !== 'live') return;
      if (String(body.value) === 'removed' && String(body.confirm) !== 'yes') return;
      if (!['live', 'paused', 'off', 'removed'].includes(String(body.value))) return;
      await this.write({ ...current, state: value });
      return;
    }
    if (action === 'restore') {
      await this.write({ ...current, state: 'live', sections: normalizeSections({}) });
      return;
    }
    if (action === 'billing') {
      if (body.value !== 'free' && body.value !== 'paid') return;
      await this.write({ ...current, billing: body.value });
      return;
    }
    if (action === 'section') {
      const name = String(body.name || '') as SectionKey;
      if (name !== 'admin' && name !== 'superAdmin') return;
      if (body.value !== 'on' && body.value !== 'off') return;
      const sections = { ...current.sections, [name]: body.value === 'on' };
      await this.write({ ...current, sections });
      return;
    }
    if (action === 'money') {
      const amount = money(body.value);
      const next = { ...current };
      const name = String(body.name || '');
      if (name === 'staff') next.staffPriceSom = amount;
      else if (name === 'otpPrice') next.otpPriceSom = amount;
      else if (name === 'otpCredit') next.otpCreditSom = amount;
      else if (name === 'aiPrice') next.aiPriceSom = amount;
      else if (name === 'aiCredit') next.aiCreditSom = amount;
      else return;
      await this.write(next);
      if (name === 'staff') {
        await this.prisma.platformSubscription.upsert({
          where: { id: 'platform' },
          create: { id: 'platform', status: 'active', priceSom: amount, priceOverride: amount },
          update: { priceSom: amount, priceOverride: amount },
        }).catch(() => undefined);
      }
    }
  }

  async listFeed(): Promise<OwnerFeedItem[]> {
    try {
      const rows = await this.prisma.ownerFeed.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      return rows.map((row) => ({
        at: row.createdAt.toISOString(),
        phone: row.phone,
        code: row.code,
        detail: row.detail,
      }));
    } catch {
      return [];
    }
  }

  /**
   * OTP or AI send. Price 0 always allows the send. A short balance keeps the
   * code here and skips the outside provider.
   */
  async claimSend(kind: 'otp' | 'ai', meta: { phone?: string; code?: string; purpose?: string }): Promise<{ send: boolean }> {
    const snap = await this.readFresh();
    const price = kind === 'otp' ? snap.otpPriceSom : snap.aiPriceSom;
    const credit = kind === 'otp' ? snap.otpCreditSom : snap.aiCreditSom;
    const result = spend(credit, price);
    const phone = meta.phone || '';
    const code = meta.code || '';
    if (!result.ok) {
      await this.note(
        phone,
        code,
        kind === 'otp' ? 'SMS ketmadi. OTP qoldig‘i yetarli emas.' : 'Sun’iy intellekt to‘xtadi. Qoldiq yetarli emas.',
      );
      return { send: false };
    }
    if (price > 0) {
      const next = { ...snap };
      if (kind === 'otp') next.otpCreditSom = result.next;
      else next.aiCreditSom = result.next;
      await this.write(next);
    }
    if (kind === 'otp') {
      await this.note(phone, code, `SMS yuborilmoqda (${meta.purpose || 'login'})`);
    }
    return { send: true };
  }

  async markSendFailed(kind: 'otp' | 'ai', detail: string): Promise<void> {
    const snap = await this.readFresh();
    const price = kind === 'otp' ? snap.otpPriceSom : snap.aiPriceSom;
    if (price > 0) {
      const next = { ...snap };
      if (kind === 'otp') next.otpCreditSom = Math.min(100_000_000, snap.otpCreditSom + price);
      else next.aiCreditSom = Math.min(100_000_000, snap.aiCreditSom + price);
      await this.write(next);
    }
    await this.note('', '', detail);
  }

  async rememberSmsBalance(balance: number | null | undefined): Promise<void> {
    if (typeof balance !== 'number' || !Number.isFinite(balance)) return;
    const snap = await this.readFresh();
    await this.write({ ...snap, smsBalance: Math.max(0, Math.floor(balance)) });
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

  private async note(phone: string, code: string, detail: string): Promise<void> {
    try {
      await this.prisma.ownerFeed.create({
        data: { phone: phone.slice(0, 32), code: code.slice(0, 12), detail: detail.slice(0, 180) },
      });
      const stale = await this.prisma.ownerFeed.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 40,
        select: { id: true },
      });
      if (stale.length) {
        await this.prisma.ownerFeed.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
      }
    } catch {
      /* The feed table appears after migrate. A missing table must not block login. */
    }
  }

  private async write(snap: GateSnapshot): Promise<void> {
    const data = {
      state: snap.state,
      billing: snap.billing,
      sections: snap.sections,
      staffPriceSom: snap.staffPriceSom,
      otpPriceSom: snap.otpPriceSom,
      otpCreditSom: snap.otpCreditSom,
      aiPriceSom: snap.aiPriceSom,
      aiCreditSom: snap.aiCreditSom,
      smsBalance: snap.smsBalance,
    };
    await this.prisma.platformGate.upsert({
      where: { id: 'gate' },
      create: { id: 'gate', ...data },
      update: data,
    });
    this.cached = { at: Date.now(), snap };
    rememberGate(snap);
  }
}
