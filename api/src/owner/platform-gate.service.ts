import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { rememberGate } from './platform-gate.cache';
import {
  AI_PAUSE_NOTICE,
  AI_PAYMENT_NOTICE,
  BILLING_PAUSE_NOTICE,
  LOCK_OFF_PHRASE,
  LOCK_ON_PHRASE,
  LOCKDOWN_NOTICE,
  MAINTENANCE_NOTICE,
  OTP_PAUSE_NOTICE,
  OTP_PAYMENT_NOTICE,
  REGISTER_PAUSE_NOTICE,
  claimDecision,
  decideAccess,
  defaultSnapshot,
  decommissionPlan,
  feedPurpose,
  feedStatus,
  isStaffSection,
  money,
  normalizeBilling,
  normalizeHistory,
  normalizeHolds,
  normalizeSections,
  normalizeState,
  parseMoney,
  paymentHoldForPrice,
  reduceProviderEvent,
  type AccessDecision,
  type AuditEvent,
  type ClaimReason,
  type GateSnapshot,
  type InventoryLine,
  type SectionKey,
  type ServiceHolds,
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

export type FeedEvent = { at: string; status: string; error: string };

export type OwnerFeedItem = {
  at: string;
  phone: string;
  code: string;
  detail: string;
  purpose: string;
  status: string;
  smsId: number | null;
  requestId: string;
  providerStatus: string;
  errorCode: string;
  syncedAt: string | null;
  events: FeedEvent[];
};

export type ClaimResult = { send: boolean; feedId?: string; reason: ClaimReason };

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
      holds: snap.holds,
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

  async apply(body: { action?: string; value?: string; confirm?: string; name?: string; password?: string }): Promise<PayPrompt | null> {
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
      if (!isStaffSection(name)) return null;
      if (body.value !== 'on' && body.value !== 'off') return null;
      const sections = { ...current.sections, [name]: body.value === 'on' };
      await this.patch({ sections });
      await this.audit('section', name, 'ok', body.value === 'on' ? 'ochildi' : 'yopildi');
      return null;
    }
    if (action === 'hold') {
      const name = String(body.name || '') as keyof ServiceHolds;
      if (!['registrations', 'otp', 'ai', 'billing', 'maintenance'].includes(name)) return null;
      if (body.value !== 'on' && body.value !== 'off') return null;
      if (body.value === 'off' && !(await this.ownerPassword(String(body.password || ''), 'hold'))) {
        throw new HttpException("Parol noto'g'ri.", 401);
      }
      const holds = { ...current.holds, [name]: body.value === 'on' };
      await this.patch({ holds });
      await this.audit('hold', name, 'ok', body.value);
      return null;
    }
    if (action === 'lock') {
      const turningOn = String(body.name || '') !== 'off';
      const phrase = String(body.value || '');
      if (phrase !== (turningOn ? LOCK_ON_PHRASE : LOCK_OFF_PHRASE)) {
        throw new HttpException(turningOn ? "Tasdiq so'zi: YOPISH" : "Tasdiq so'zi: OCHISH", 400);
      }
      if (!(await this.ownerPassword(String(body.password || ''), 'lock'))) {
        throw new HttpException("Parol noto'g'ri.", 401);
      }
      const holds = { ...current.holds, lockdown: turningOn };
      await this.patch(turningOn ? { holds, sessionsCut: new Date() } : { holds });
      if (turningOn) await this.prisma.refreshToken.deleteMany({}).catch(() => undefined);
      await this.audit('lock', 'lockdown', 'ok', turningOn ? 'yoqildi' : 'ochildi');
      return null;
    }
    if (action === 'revoke') {
      if (!(await this.ownerPassword(String(body.password || ''), 'revoke'))) {
        throw new HttpException("Parol noto'g'ri.", 401);
      }
      await this.patch({ sessionsCut: new Date() });
      await this.prisma.refreshToken.deleteMany({}).catch(() => undefined);
      await this.audit('revoke', 'sessions', 'ok', 'foydalanuvchi sessiyalari yopildi');
      return null;
    }
    if (action === 'resume') {
      const kind = body.name === 'ai' ? 'ai' : body.name === 'otp' ? 'otp' : '';
      if (!kind) return null;
      if (!(await this.ownerPassword(String(body.password || ''), 'resume'))) {
        throw new HttpException("Parol noto'g'ri.", 401);
      }
      const price = kind === 'otp' ? current.otpPriceSom : current.aiPriceSom;
      const credit = kind === 'otp' ? current.otpCreditSom : current.aiCreditSom;
      if (paymentHoldForPrice(price, credit)) throw new HttpException("Qoldiq yetarli emas.", 400);
      const holds = { ...current.holds, [kind === 'otp' ? 'otpPayment' : 'aiPayment']: false };
      await this.patch({ holds });
      await this.audit('resume', kind, 'ok', 'to‘lov tasdiqlandi');
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
      const credit = name === 'otpPrice' ? current.otpCreditSom : current.aiCreditSom;
      const hold = paymentHoldForPrice(amount, credit);
      const holds = {
        ...current.holds,
        [name === 'otpPrice' ? 'otpPayment' : 'aiPayment']: hold,
      };
      if (name === 'otpPrice') await this.patch({ otpPriceSom: amount, holds });
      else await this.patch({ aiPriceSom: amount, holds });
      await this.audit('price', name, 'ok', hold ? 'to‘lov kutiladi' : 'saqlandi');
      if (hold) {
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
        smsId: row.providerSmsId ?? null,
        requestId: row.providerRequestId || '',
        providerStatus: row.providerStatus || '',
        errorCode: row.errorCode || '',
        syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
        events: readEvents(row.events),
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
  async claimSend(kind: 'otp' | 'ai', meta: { phone?: string; code?: string; purpose?: string }): Promise<ClaimResult> {
    const phone = (meta.phone || '').slice(0, 32);
    const code = (meta.code || '').slice(0, 12);
    const purpose = (meta.purpose || (kind === 'ai' ? 'ai' : 'login')).slice(0, 24);
    const result = await this.locked(async (tx) => {
      const row = await tx.platformGate.findUnique({ where: { id: 'gate' } });
      if (!row) return { send: false as const, reason: 'paused' as const };
      const holds = normalizeHolds(row.holds);
      const price = kind === 'otp' ? money(row.otpPriceSom) : money(row.aiPriceSom);
      const credit = kind === 'otp' ? money(row.otpCreditSom) : money(row.aiCreditSom);
      const decision = claimDecision({ kind, holds, price, credit });
      if (!decision.send) {
        const detail = denialDetail(kind, decision.reason);
        const status = decision.reason === 'payment' || decision.reason === 'short' ? 'short' : 'cancelled';
        const feedId = kind === 'otp'
          ? await this.noteTx(tx, phone, code, detail, purpose, status)
          : undefined;
        return { send: false as const, feedId, reason: decision.reason };
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
      return { send: true as const, feedId, reason: 'ok' as const };
    });
    this.cached = null;
    return result;
  }

  /** Preview only. The locked claimSend is still the authority. */
  async explainOtp(purpose: string): Promise<{ send: boolean; message: string; reason: ClaimReason }> {
    const snap = await this.snapshot();
    if (snap.holds.lockdown) return { send: false, message: LOCKDOWN_NOTICE, reason: 'lockdown' };
    if (snap.holds.maintenance) return { send: false, message: MAINTENANCE_NOTICE, reason: 'paused' };
    if (purpose === 'register' && snap.holds.registrations) {
      return { send: false, message: REGISTER_PAUSE_NOTICE, reason: 'paused' };
    }
    const decision = claimDecision({
      kind: 'otp',
      holds: snap.holds,
      price: snap.otpPriceSom,
      credit: snap.otpCreditSom,
    });
    if (!decision.send) {
      const message = decision.reason === 'payment' || decision.reason === 'short' ? OTP_PAYMENT_NOTICE : OTP_PAUSE_NOTICE;
      return { send: false, message, reason: decision.reason };
    }
    return { send: true, message: '', reason: 'ok' };
  }

  async explainRegister(): Promise<{ allow: boolean; message: string }> {
    const snap = await this.snapshot();
    if (snap.holds.lockdown) return { allow: false, message: LOCKDOWN_NOTICE };
    if (snap.holds.maintenance) return { allow: false, message: MAINTENANCE_NOTICE };
    if (snap.holds.registrations) return { allow: false, message: REGISTER_PAUSE_NOTICE };
    return { allow: true, message: '' };
  }

  async explainBilling(): Promise<{ allow: boolean; message: string }> {
    const snap = await this.snapshot();
    if (snap.holds.lockdown) return { allow: false, message: LOCKDOWN_NOTICE };
    if (snap.holds.billing) return { allow: false, message: BILLING_PAUSE_NOTICE };
    return { allow: true, message: '' };
  }

  aiDenial(reason: ClaimReason): string {
    if (reason === 'payment' || reason === 'short') return AI_PAYMENT_NOTICE;
    if (reason === 'lockdown') return LOCKDOWN_NOTICE;
    return AI_PAUSE_NOTICE;
  }

  async markSendDelivered(feedId?: string, meta?: { smsId?: number; requestId?: string; providerStatus?: string }): Promise<void> {
    if (!feedId) return;
    const smsId = meta?.smsId && meta.smsId > 0 ? meta.smsId : null;
    await this.prisma.ownerFeed.update({
      where: { id: feedId },
      data: {
        status: 'accepted',
        detail: 'Provayder qabul qildi. Yetkazilganlik alohida.',
        providerSmsId: smsId,
        providerRequestId: (meta?.requestId || '').slice(0, 80),
        providerStatus: (meta?.providerStatus || 'accepted').slice(0, 32),
        events: [{ at: new Date().toISOString(), status: 'accepted', error: '' }],
      },
    }).catch(() => undefined);
  }

  async markSendFailed(kind: 'otp' | 'ai', detail: string, feedId?: string): Promise<void> {
    await this.locked(async (tx) => {
      const row = await tx.platformGate.findUnique({ where: { id: 'gate' } });
      const feed = feedId ? await tx.ownerFeed.findUnique({ where: { id: feedId } }).catch(() => null) : null;
      const price = row ? (kind === 'otp' ? money(row.otpPriceSom) : money(row.aiPriceSom)) : 0;
      const already = Boolean(feed?.refunded);
      if (row && price > 0 && !already) {
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
          data: {
            status: 'error',
            detail: text,
            refunded: price > 0 || already,
            events: pushEvent(feed?.events, 'error', text),
          },
        }).catch(() => undefined);
      } else if (kind === 'otp') {
        await this.noteTx(tx, '', '', text, '', 'error');
      }
    });
    this.cached = null;
  }

  async applyProviderEvent(input: {
    smsId?: number | null;
    requestId?: string;
    status?: string;
    error?: string;
  }): Promise<'applied' | 'duplicate' | 'missing'> {
    const smsId = input.smsId && input.smsId > 0 ? input.smsId : null;
    const requestId = (input.requestId || '').slice(0, 80);
    if (!smsId && !requestId) return 'missing';
    let found = smsId
      ? await this.prisma.ownerFeed.findFirst({ where: { providerSmsId: smsId }, orderBy: { createdAt: 'desc' } })
      : null;
    if (!found && requestId) {
      found = await this.prisma.ownerFeed.findFirst({
        where: { providerRequestId: requestId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!found) return 'missing';
    return this.writeProviderEvent(found.id, input.status || '', input.error || '');
  }

  async markFeedVerified(phone: string): Promise<void> {
    await this.markFeedLocal(phone, 'verified', 'Kod tasdiqlandi');
  }

  async markFeedExpired(phone: string): Promise<void> {
    await this.markFeedLocal(phone, 'expired', 'Muddat tugadi');
  }

  async rememberSmsBalance(balance: number | null | undefined, error = ''): Promise<void> {
    if (typeof balance === 'number' && Number.isFinite(balance)) {
      await this.patch({
        smsBalance: Math.max(0, Math.floor(balance)),
        smsSyncedAt: new Date(),
        smsSyncError: '',
      });
      return;
    }
    if (error) await this.patch({ smsSyncError: error.slice(0, 180) }).catch(() => undefined);
  }

  async listHistory(): Promise<AuditEvent[]> {
    try {
      const row = await this.prisma.platformGate.findUnique({ where: { id: 'gate' } });
      return normalizeHistory(row?.configHistory).reverse();
    } catch {
      return [];
    }
  }

  async openFeeds(limit = 12): Promise<Array<{ id: string; smsId: number | null; requestId: string; status: string }>> {
    try {
      const rows = await this.prisma.ownerFeed.findMany({
        where: {
          status: { in: ['created', 'queued', 'sending', 'accepted', 'sent', 'pending', 'unknown'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      });
      return rows
        .filter((row) => (row.providerSmsId && row.providerSmsId > 0) || (row.providerRequestId && !row.providerRequestId.startsWith('dev-')))
        .slice(0, limit)
        .map((row) => ({
          id: row.id,
          smsId: row.providerSmsId,
          requestId: row.providerRequestId,
          status: row.status,
        }));
    } catch {
      return [];
    }
  }

  inventory(probed: { cwd: string; remote: string; branch: string }): { lines: InventoryLine[]; notes: string[] } {
    return decommissionPlan(probed);
  }

  async sessionCount(): Promise<number> {
    try {
      return await this.prisma.refreshToken.count();
    } catch {
      return 0;
    }
  }

  async noteDead(reason: string): Promise<void> {
    await this.audit('sms-hook', 'dead', 'dead', reason.slice(0, 180));
  }

  async noteAccess(outcome: 'ok' | 'fail', ip: string): Promise<void> {
    const clean = (ip || '').slice(0, 64);
    await this.audit('login', 'owner', outcome, clean ? `IP ${clean}. Bu joylashuv emas.` : '');
  }

  private async ownerPassword(password: string, bucket: string): Promise<boolean> {
    this.hit(bucket);
    return bcrypt.compare(password || ' ', OWNER_PASSWORD_HASH);
  }

  private async audit(action: string, target: string, outcome: string, reason: string): Promise<void> {
    try {
      const row = await this.prisma.platformGate.findUnique({ where: { id: 'gate' } });
      const history = normalizeHistory(row?.configHistory);
      history.push({
        at: new Date().toISOString(),
        actor: 'owner',
        action: action.slice(0, 40),
        target: target.slice(0, 40),
        outcome: outcome.slice(0, 24),
        reason: reason.slice(0, 180),
      });
      await this.prisma.platformGate.update({
        where: { id: 'gate' },
        data: { configHistory: history.slice(-80) },
      });
    } catch {
      /* A history write must not undo the action. */
    }
  }

  private async writeProviderEvent(id: string, rawStatus: string, error: string): Promise<'applied' | 'duplicate' | 'missing'> {
    const result = await this.locked(async (tx) => {
      const feed = await tx.ownerFeed.findUnique({ where: { id } });
      if (!feed) return 'missing' as const;
      const previous = readEvents(feed.events);
      const reduced = reduceProviderEvent({
        status: feed.status,
        refunded: feed.refunded,
        seen: previous.map((item) => item.status),
        incoming: rawStatus,
      });
      if (reduced.duplicate) return 'duplicate' as const;
      let refunded = feed.refunded;
      if (reduced.refund) {
        const gate = await tx.platformGate.findUnique({ where: { id: 'gate' } });
        const price = gate ? money(gate.otpPriceSom) : 0;
        if (gate && price > 0) {
          const next = Math.min(100_000_000, money(gate.otpCreditSom) + price);
          await tx.platformGate.update({ where: { id: 'gate' }, data: { otpCreditSom: next } });
          await this.journalTx(tx, 'otp', 'system', price, next, 'Yetkazilmadi, qaytarildi');
        }
        refunded = true;
      }
      const events = reduced.seen.map((status) => {
        return previous.find((item) => item.status === status)
          || { at: new Date().toISOString(), status, error: error.slice(0, 120) };
      });
      await tx.ownerFeed.update({
        where: { id },
        data: {
          status: reduced.status.slice(0, 16),
          providerStatus: rawStatus.slice(0, 32),
          errorCode: error.slice(0, 80),
          syncedAt: new Date(),
          refunded,
          events,
          detail: statusDetail(reduced.status),
        },
      });
      return 'applied' as const;
    });
    this.cached = null;
    return result;
  }

  private async markFeedLocal(phone: string, status: 'verified' | 'expired', detail: string): Promise<void> {
    const clean = phone.slice(0, 32);
    if (!clean) return;
    const feed = await this.prisma.ownerFeed.findFirst({
      where: { phone: clean },
      orderBy: { createdAt: 'desc' },
    }).catch(() => null);
    if (!feed || feed.status === 'short') return;
    const previous = readEvents(feed.events);
    const reduced = reduceProviderEvent({
      status: feed.status,
      refunded: true,
      seen: previous.map((item) => item.status),
      incoming: status,
    });
    if (reduced.duplicate) return;
    await this.prisma.ownerFeed.update({
      where: { id: feed.id },
      data: {
        status: reduced.status,
        detail,
        events: reduced.seen.map((item) => previous.find((row) => row.status === item) || {
          at: new Date().toISOString(),
          status: item,
          error: '',
        }),
      },
    }).catch(() => undefined);
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
    holds?: unknown;
    smsSyncedAt?: Date | null;
    smsSyncError?: string | null;
    sessionsCut?: Date | null;
  }): GateSnapshot {
    const flags = providerFlags();
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
      holds: normalizeHolds(row.holds),
      smsSyncedAt: row.smsSyncedAt ? row.smsSyncedAt.toISOString() : null,
      smsSyncError: row.smsSyncError || '',
      sessionsCut: row.sessionsCut ? row.sessionsCut.toISOString() : null,
      providerConfigured: flags.providerConfigured,
      webhookConfigured: flags.webhookConfigured,
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

function providerFlags(): { providerConfigured: boolean; webhookConfigured: boolean } {
  const token = (process.env.DEVSMS_TOKEN || '').trim();
  return {
    providerConfigured: Boolean(token && token !== 'your_token'),
    webhookConfigured: Boolean((process.env.DEVSMS_WEBHOOK_SECRET || '').trim()),
  };
}

function readEvents(value: unknown): FeedEvent[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      at: String(row.at || ''),
      status: String(row.status || '').slice(0, 16),
      error: String(row.error || '').slice(0, 120),
    };
  }).filter((item) => item.status);
}

function pushEvent(value: unknown, status: string, error: string): FeedEvent[] {
  const events = readEvents(value);
  if (events.some((item) => item.status === status)) return events;
  events.push({ at: new Date().toISOString(), status, error: error.slice(0, 120) });
  return events.slice(-20);
}

function denialDetail(kind: 'otp' | 'ai', reason: ClaimReason): string {
  if (reason === 'payment' || reason === 'short') return kind === 'otp' ? 'Balans yetmadi' : AI_PAYMENT_NOTICE;
  if (reason === 'lockdown') return 'To‘liq to‘xtatish';
  return kind === 'otp' ? 'SMS to‘xtatilgan' : 'Sun’iy intellekt to‘xtatilgan';
}

function statusDetail(status: string): string {
  if (status === 'accepted' || status === 'sent') return 'Provayder qabul qildi. Yetkazilganlik alohida.';
  if (status === 'delivered') return 'Yetkazildi';
  if (status === 'failed' || status === 'blocked') return 'Yetkazilmadi';
  if (status === 'expired') return 'Muddat tugadi';
  if (status === 'cancelled') return 'Bekor qilindi';
  if (status === 'verified') return 'Kod tasdiqlandi';
  if (status === 'refunded') return 'Qaytarildi';
  return status;
}
