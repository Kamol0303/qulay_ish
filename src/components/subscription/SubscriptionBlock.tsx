import React, { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, Loader, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useSubscription } from '../../context/SubscriptionContext';

function formatSom(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

function formatCard(raw: string): string {
  const digits = raw.replace(/\s/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

type Step = 'pay' | 'otp';

/** Payment frame. Opens on the Super Admin panel only after the month has ended. */
export default function SubscriptionBlock() {
  const { status, refresh } = useSubscription();
  const [step, setStep] = useState<Step>('pay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<{ cardNumber: string; amount: number } | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!status?.blocked) return;
    let cancelled = false;
    setLoading(true);
    api.subscription
      .pay()
      .then((details) => {
        if (!cancelled) setCard(details);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Xatolik');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status?.blocked]);

  if (!status?.blocked) return null;

  const amount = card?.amount ?? status.priceSom ?? 0;

  async function handlePaid() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.subscription.requestOtp();
      setMaskedPhone(res.maskedPhone);
      setStep('otp');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod yuborilmadi');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      await api.subscription.verifyOtp(code.trim());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kod noto'g'ri");
    } finally {
      setLoading(false);
    }
  }

  async function copyCard() {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.cardNumber.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-pay-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#c6a15b] bg-card p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
            <CreditCard className="h-7 w-7 text-[#1a7c78]" />
          </div>
          <h2 id="subscription-pay-title" className="text-2xl font-black text-foreground">
            To'lovni amalga oshiring
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sun'iy intellekt va SMS xizmati uchun oylik to'lov. Ishchi va buyurtmachilar uchun platforma bepul.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {step === 'pay' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-secondary/40 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Karta raqami</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-mono text-lg font-black tracking-wider text-foreground">
                  {card ? formatCard(card.cardNumber) : loading ? '...' : '—'}
                </p>
                {card && (
                  <button
                    type="button"
                    onClick={copyCard}
                    className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-bold"
                  >
                    {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                    {copied ? 'Nusxalandi' : 'Nusxa'}
                  </button>
                )}
              </div>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Summa</p>
              <p className="text-xl font-black text-foreground">{formatSom(amount)} so'm</p>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Shu kartaga to'lov qiling. To'lovni amalga oshirdim tugmasi bosilganda 6 xonali kod faqat telefon raqamiga yuboriladi.
            </p>
            <button
              type="button"
              onClick={handlePaid}
              disabled={loading || !card}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1a7c78] font-bold text-white disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              To'lovni amalga oshirdim
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">
              6 xonali kodni oling. Kod faqat <span className="font-bold">{maskedPhone}</span> raqamiga yuborildi.
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="______"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none"
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#1a7c78] font-bold text-white disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Tasdiqlash
            </button>
            <button
              type="button"
              onClick={handlePaid}
              disabled={loading}
              className="w-full text-center text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              Kodni qayta yuborish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
