import { Body, Controller, Get, HttpException, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OWNER_COOKIE, OWNER_PATH } from './owner.constants';
import { OwnerFormDto } from './owner.dto';
import { renderOwnerPage } from './owner.page';
import { PlatformGateService } from './platform-gate.service';

function readCookie(raw: string | undefined, name: string): string {
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function cookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${OWNER_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=${OWNER_PATH}; Max-Age=${maxAge}${secure}`;
}

function prepare(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
}

function wantsJson(req: Request, body: OwnerFormDto): boolean {
  return body?.format === 'json' || String(req.headers.accept || '').includes('application/json');
}

@Controller('gate')
export class PublicGateController {
  constructor(private readonly gate: PlatformGateService) {}

  @Get()
  async show() {
    const snap = await this.gate.snapshot();
    return { state: snap.state, sections: snap.sections };
  }
}

@Controller('m/k5700')
export class OwnerController {
  constructor(private readonly gate: PlatformGateService) {}

  @Get()
  async page(@Req() req: Request, @Res() res: Response) {
    prepare(res);
    const authed = this.gate.valid(readCookie(req.headers.cookie, OWNER_COOKIE));
    const view = authed ? await this.view() : { snap: null, feed: [], ledger: [], subscription: { until: null, days: null } };
    res.type('html').send(renderOwnerPage({ authed, ...view }));
  }

  @Post()
  async submit(@Req() req: Request, @Res() res: Response, @Body() body: OwnerFormDto) {
    prepare(res);
    const action = String(body?.action || '');
    const json = wantsJson(req, body || {});
    if (action === 'login') {
      try {
        const ok = await this.gate.checkLogin(String(body.phone || ''), String(body.password || ''), req.ip || 'unknown');
        if (!ok) {
          res.status(401).type('html').send(renderOwnerPage({ authed: false, snap: null, error: "Login yoki parol noto'g'ri." }));
          return;
        }
      } catch (err) {
        const message = err instanceof HttpException ? String(err.message) : "Login yoki parol noto'g'ri.";
        res.status(429).type('html').send(renderOwnerPage({ authed: false, snap: null, error: message }));
        return;
      }
      res.setHeader('Set-Cookie', cookie(this.gate.sign(), 60 * 60 * 12));
      res.redirect(303, OWNER_PATH);
      return;
    }

    if (!this.gate.valid(readCookie(req.headers.cookie, OWNER_COOKIE))) {
      if (json) {
        res.status(401).json({ ok: false, error: 'Kirish kerak.' });
        return;
      }
      res.redirect(303, OWNER_PATH);
      return;
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', cookie('', 0));
      res.redirect(303, OWNER_PATH);
      return;
    }
    try {
      const prompt = await this.gate.apply(body || {});
      if (json) {
        const view = await this.view();
        res.json({ ok: true, message: 'Saqlandi', prompt, ...view });
        return;
      }
    } catch (err) {
      const message = err instanceof HttpException && err.getStatus() < 500
        ? String(err.message)
        : "Saqlab bo'lmadi. Serverda baza yangilanishi kerak.";
      const status = err instanceof HttpException && err.getStatus() < 500 ? err.getStatus() : 500;
      if (json) {
        res.status(status).json({ ok: false, error: message });
        return;
      }
      const view = await this.view();
      res.status(status).type('html').send(renderOwnerPage({ authed: true, ...view, error: message }));
      return;
    }
    res.redirect(303, OWNER_PATH);
  }

  private async view() {
    const [snap, feed, ledger, subscription] = await Promise.all([
      this.gate.snapshot(),
      this.gate.listFeed(),
      this.gate.listLedger(),
      this.gate.subscriptionBrief(),
    ]);
    return { snap, feed, ledger, subscription };
  }
}
