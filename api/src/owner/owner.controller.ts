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
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  );
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
    const snap = authed ? await this.gate.snapshot() : null;
    const feed = authed ? await this.gate.listFeed() : [];
    res.type('html').send(renderOwnerPage({ authed, snap, feed }));
  }

  @Post()
  async submit(@Req() req: Request, @Res() res: Response, @Body() body: OwnerFormDto) {
    prepare(res);
    const action = String(body?.action || '');
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
      res.redirect(303, OWNER_PATH);
      return;
    }
    if (action === 'logout') {
      res.setHeader('Set-Cookie', cookie('', 0));
      res.redirect(303, OWNER_PATH);
      return;
    }
    try {
      await this.gate.apply(body || {});
    } catch {
      const snap = await this.gate.snapshot();
      const feed = await this.gate.listFeed();
      res.status(500).type('html').send(renderOwnerPage({
        authed: true,
        snap,
        feed,
        error: "Saqlab bo'lmadi. Serverda baza yangilanishi kerak.",
      }));
      return;
    }
    res.redirect(303, OWNER_PATH);
  }
}
