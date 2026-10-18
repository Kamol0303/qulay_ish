import { HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { rememberGate } from './platform-gate.cache';
import {
  decideAccess,
  defaultSnapshot,
  normalizeBilling,
  normalizeSections,
  normalizeState,
  SECTION_KEYS,
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

  async decide(req: GateRequest): Promise<AccessDecision> {
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
    const current = await this.read();
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
      if (!SECTION_KEYS.includes(name)) return;
      if (body.value !== 'on' && body.value !== 'off') return;
      const sections = { ...current.sections, [name]: body.value === 'on' };
      await this.write({ ...current, sections });
    }
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
          data: { id: 'gate', state: 'live', billing: 'paid', sections: {} },
        });
        return {
          state: normalizeState(created.state),
          billing: normalizeBilling(created.billing),
          sections: normalizeSections(created.sections),
        };
      }
      return {
        state: normalizeState(row.state),
        billing: normalizeBilling(row.billing),
        sections: normalizeSections(row.sections),
      };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2021' || err.code === 'P2022')) {
        return defaultSnapshot();
      }
      const message = err instanceof Error ? err.message : '';
      if (message.includes('platform_gate') || message.includes('does not exist')) return defaultSnapshot();
      return defaultSnapshot();
    }
  }

  private async write(snap: GateSnapshot): Promise<void> {
    await this.prisma.platformGate.upsert({
      where: { id: 'gate' },
      create: { id: 'gate', state: snap.state, billing: snap.billing, sections: snap.sections },
      update: { state: snap.state, billing: snap.billing, sections: snap.sections },
    });
    this.cached = { at: Date.now(), snap };
    rememberGate(snap);
  }
}
