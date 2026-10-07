import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DevSmsService } from '../auth/devsms.service';
import {
  PAYMENT_OTP_MAX_ATTEMPTS,
  PAYMENT_OTP_RATE_LIMIT_MS,
  PAYMENT_OTP_TTL_MS,
  pickRoundPrice,
  snapPrice,
  SUBSCRIPTION_FREE_DAYS,
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_WARNING_DAYS,
  SubscriptionStatus,
} from './subscription.config';

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  freeUntil: Date | null;
  paidUntil: Date | null;
  effectiveUntil: Date | null;
  lastPaymentAt: Date | null;
  priceSom: number;
  daysRemaining: number;
  graceDaysRemaining: number;
  inWarningWindow: boolean;
  blocked: boolean;
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devSms: DevSmsService,
  ) {}

  /**
   * Seed price (som). If SUBSCRIPTION_PRICE is set in .env it is used (clamped and
   * snapped to a round step); otherwise a random round price in 240000–300000 is
   * generated so each fresh install gets its own value ending in 000.
   */
  private envPrice(): number {
    const raw = Number(process.env.SUBSCRIPTION_PRICE);
    return Number.isFinite(raw) && raw > 0
      ? snapPrice(raw)
      : pickRoundPrice((steps) => randomInt(0, steps + 1));
  }

  /** Lazily create the singleton row with a fresh free trial. */
  private async ensureRow() {
    const existing = await this.prisma.platformSubscription.findUnique({
      where: { id: 'platform' },
    });
    if (existing) return existing;
    const now = new Date();
    return this.prisma.platformSubscription.create({
      data: {
        id: 'platform',
        status: 'active',
        freeUntil: addDays(now, SUBSCRIPTION_FREE_DAYS),
        priceSom: this.envPrice(),
      },
    });
  }

  async getSnapshot(): Promise<SubscriptionSnapshot> {
    const row = await this.ensureRow();
    const now = Date.now();
    const effectiveUntil = row.paidUntil ?? row.freeUntil ?? null;
    const effMs = effectiveUntil ? effectiveUntil.getTime() : 0;

    let status: SubscriptionStatus;
    if (!effectiveUntil || now <= effMs) {
      status = 'active';
    } else if (now <= effMs + SUBSCRIPTION_GRACE_DAYS * DAY_MS) {
      status = 'grace';
    } else {
      status = 'expired';
    }

    const daysRemaining = effectiveUntil
      ? Math.ceil((effMs - now) / DAY_MS)
      : SUBSCRIPTION_FREE_DAYS;
    const graceDaysRemaining =
      status === 'grace'
        ? Math.ceil((effMs + SUBSCRIPTION_GRACE_DAYS * DAY_MS - now) / DAY_MS)
        : 0;
    const inWarningWindow =
      status === 'active' && daysRemaining <= SUBSCRIPTION_WARNING_DAYS;

    // Persist derived status when it drifts (keeps DB/audit queries consistent).
    if (row.status !== status) {
      await this.prisma.platformSubscription
        .update({ where: { id: 'platform' }, data: { status } })
        .catch(() => undefined);
    }

    return {
      status,
      freeUntil: row.freeUntil,
      paidUntil: row.paidUntil,
      effectiveUntil,
      lastPaymentAt: row.lastPaymentAt,
      priceSom: row.priceSom,
      daysRemaining,
      graceDaysRemaining,
      inWarningWindow,
      blocked: status === 'expired',
    };
  }

  async isBlocked(): Promise<boolean> {
    const snap = await this.getSnapshot();
    return snap.blocked;
  }

  async setPrice(priceSom: number): Promise<SubscriptionSnapshot> {
    const clamped = snapPrice(priceSom);
    await this.ensureRow();
    await this.prisma.platformSubscription.update({
      where: { id: 'platform' },
      data: { priceSom: clamped },
    });
    return this.getSnapshot();
  }

  /** Non-secret payment details for the block screen. Card comes from .env. */
  async getPaymentDetails(): Promise<{ cardNumber: string; amount: number }> {
    const snap = await this.getSnapshot();
    const cardNumber = (process.env.PAYMENT_CARD_NUMBER || '').trim();
    if (!cardNumber) {
      throw new HttpException(
        "To'lov karta raqami sozlanmagan (.env PAYMENT_CARD_NUMBER)",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { cardNumber, amount: snap.priceSom };
  }

  private maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***';
    return `+${digits.slice(0, 3)}***${digits.slice(-2)}`;
  }

  /**
   * User pressed "I paid": generate a 6-digit OTP, store only its hash, and SMS
   * the code to the owner phone. Rate-limited per requester.
   */
  async requestPaymentOtp(requestedBy: string): Promise<{ sent: true; maskedPhone: string; expiresInMs: number }> {
    const ownerPhone = (process.env.OWNER_OTP_PHONE || '').trim();
    if (!ownerPhone) {
      throw new HttpException(
        "Egasi telefon raqami sozlanmagan (.env OWNER_OTP_PHONE)",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const recent = await this.prisma.paymentOtp.findFirst({
      where: {
        requestedBy,
        createdAt: { gte: new Date(Date.now() - PAYMENT_OTP_RATE_LIMIT_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new HttpException(
        "Bir daqiqada faqat bitta kod so'rash mumkin",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Invalidate any outstanding unconsumed codes for this requester.
    await this.prisma.paymentOtp.updateMany({
      where: { requestedBy, consumed: false, locked: false },
      data: { locked: true },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.paymentOtp.create({
      data: {
        id: randomUUID(),
        codeHash,
        requestedBy,
        expiresAt: new Date(Date.now() + PAYMENT_OTP_TTL_MS),
      },
    });

    try {
      await this.devSms.sendOtpSms(ownerPhone, code, 'login');
    } catch (err) {
      this.logger.error('Payment OTP SMS yuborilmadi', err as Error);
      throw new HttpException(
        "Tasdiqlash kodi yuborilmadi. Keyinroq urinib ko'ring.",
        HttpStatus.BAD_GATEWAY,
      );
    }

    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'SUBSCRIPTION_OTP_REQUESTED',
          userId: requestedBy,
          details: { maskedPhone: this.maskPhone(ownerPhone) },
          type: 'info',
        },
      })
      .catch(() => undefined);

    return {
      sent: true,
      maskedPhone: this.maskPhone(ownerPhone),
      expiresInMs: PAYMENT_OTP_TTL_MS,
    };
  }

  /**
   * Verify the owner-provided code. On success extend the paid period by one
   * month and mark the subscription active.
   */
  async verifyPaymentOtp(requestedBy: string, code: string): Promise<SubscriptionSnapshot> {
    const normalized = String(code || '').replace(/\D/g, '');
    if (normalized.length !== 6) {
      throw new BadRequestException('Kod 6 raqamdan iborat bo\'lishi kerak');
    }

    const otp = await this.prisma.paymentOtp.findFirst({
      where: { requestedBy, consumed: false, locked: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      throw new BadRequestException("Faol tasdiqlash kodi yo'q. Qaytadan so'rang.");
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      await this.prisma.paymentOtp.update({ where: { id: otp.id }, data: { locked: true } });
      throw new BadRequestException("Kod muddati tugadi. Qaytadan so'rang.");
    }

    const ok = await bcrypt.compare(normalized, otp.codeHash);
    if (!ok) {
      const attempts = otp.attempts + 1;
      const locked = attempts >= PAYMENT_OTP_MAX_ATTEMPTS;
      await this.prisma.paymentOtp.update({
        where: { id: otp.id },
        data: { attempts, locked },
      });
      await this.prisma.systemLog
        .create({
          data: {
            id: randomUUID(),
            action: 'SUBSCRIPTION_OTP_FAILED',
            userId: requestedBy,
            details: { attempts, locked },
            type: 'warning',
          },
        })
        .catch(() => undefined);
      throw new BadRequestException(
        locked
          ? "Juda ko'p urinish. Yangi kod so'rang."
          : `Kod noto'g'ri. Qolgan urinishlar: ${PAYMENT_OTP_MAX_ATTEMPTS - attempts}`,
      );
    }

    await this.prisma.paymentOtp.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    // Extend from the later of (now, current effective end) so prepaying stacks.
    const snap = await this.getSnapshot();
    const base =
      snap.effectiveUntil && snap.effectiveUntil.getTime() > Date.now()
        ? snap.effectiveUntil
        : new Date();
    const paidUntil = addDays(base, SUBSCRIPTION_PERIOD_DAYS);
    const now = new Date();

    await this.prisma.platformSubscription.update({
      where: { id: 'platform' },
      data: {
        status: 'active',
        paidUntil,
        lastPaymentAt: now,
      },
    });

    await this.prisma.systemLog
      .create({
        data: {
          id: randomUUID(),
          action: 'SUBSCRIPTION_PAYMENT_CONFIRMED',
          userId: requestedBy,
          details: { paidUntil: paidUntil.toISOString(), amount: snap.priceSom },
          type: 'info',
        },
      })
      .catch(() => undefined);

    return this.getSnapshot();
  }
}
