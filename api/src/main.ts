import './load-env';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { urlencoded } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { decideRateLimit, pruneBuckets, type RateBucket } from './common/rate-limit.util';
import { PlatformGateService } from './owner/platform-gate.service';
import { SubscriptionService } from './subscription/subscription.service';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET?.trim()) {
    throw new Error('JWT_SECRET must be set in production');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(urlencoded({ extended: false }));
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  // Always allow website + Capacitor WebView origins (even if CORS_ORIGIN is set
  // narrowly on the server — otherwise APK gets opaque "Failed to fetch").
  const requiredOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ishliayol.uz',
    'https://www.ishliayol.uz',
    'https://mexrliqollar.uz',
    'https://www.mexrliqollar.uz',
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    // Capacitor WebView origins. App hostname stays localhost so /api is not
    // served from the APK; these extra origins cover older builds.
    'capacitor://ishliayol.uz',
    'capacitor://mexrliqollar.uz',
    'ionic://ishliayol.uz',
    'ionic://mexrliqollar.uz',
  ];
  const corsOrigins = Array.from(new Set([...requiredOrigins, ...fromEnv]));
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const rateBuckets = new Map<string, RateBucket>();
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    const forwarded = String(req.headers['x-forwarded-proto'] || '');
    if (process.env.NODE_ENV === 'production' && (req.secure || forwarded.includes('https'))) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (path === '/api/health') {
      next();
      return;
    }
    const decision = decideRateLimit(rateBuckets, path, req.ip || 'unknown', Date.now());
    pruneBuckets(rateBuckets, Date.now());
    if (!decision.ok) {
      res.setHeader('Retry-After', String(decision.retryAfterSec));
      res.status(429).json({ message: 'Juda koʻp soʻrov. Birozdan keyin urinib koʻring.' });
      return;
    }
    next();
  });

  const gate = app.get(PlatformGateService);
  const subscription = app.get(SubscriptionService);
  app.use(async (req, res, next) => {
    try {
      let paidLock = false;
      try {
        paidLock = await subscription.isBlocked();
      } catch {
        paidLock = false;
      }
      const decision = await gate.decide(req, paidLock);
      if (!decision.allow) {
        res.status(decision.status).json({ message: decision.message });
        return;
      }
    } catch {
      // A missing switch must not take the public site down.
    }
    next();
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  const publicDir = join(uploadsDir, 'public');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  // Block direct public access to private verification files
  app.use('/uploads/private', (_req, res) => {
    res.status(403).json({ message: 'Forbidden' });
  });
  app.useStaticAssets(publicDir, { prefix: '/uploads/public/' });
  // Legacy non-private uploads (profile photos before public/ split)
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  const port = Number(process.env.API_PORT || 4000);
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api`);
}

bootstrap();
