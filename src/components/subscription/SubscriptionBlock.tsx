import React, { useState } from 'react';
import { Lock, CreditCard, ShieldCheck, Loader, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useSubscription } from '../../context/SubscriptionContext';

function formatSom(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

type Step = 'intro' | 'card' | 'otp';

export default function SubscriptionBlock() {
  const { status, refresh } = useSubscription();
  const [step, setStep] = useState<Step>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<{ cardNumber: string; amount: number } | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string>('');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const amount = card?.amount ?? status?.priceSom ?? 0;

  async function handleShowCard() {
    setLoading(true);
    setError(null);
    try {
      const details = await api.subscription.pay();
      setCard(details);
      setStep('card');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }

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
      // On success the gate unmounts this component (status becomes active).
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
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">Obuna muddati tugagan</h2>
          <p className="mt-2 text-sm text-gray-600">
            Bu sahifadan foydalanishni davom ettirish uchun oylik to'lovni amalga oshiring.
            Ishchi va buyurtmachilar uchun platforma har doim bepul.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {step === 'intro' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Oylik to'lov</p>
              <p className="mt-1 text-3xl font-black text-gray-900">{formatSom(amount)} so'm</p>
            </div>
            <button
              onClick={handleShowCard}
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <CreditCard size={18} />}
              To'lov qilish
            </button>
          </div>
        )}

        {step === 'card' && card && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Karta raqami</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="font-mono text-lg font-black tracking-wider">{card.cardNumber}</p>
                <button
                  onClick={copyCard}
                  className="flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs font-bold hover:bg-white/30"
                >
                  {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                  {copied ? 'Nusxalandi' : 'Nusxa'}
                </button>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-100">Summa</p>
              <p className="text-xl font-black">{formatSom(card.amount)} so'm</p>
            </div>
            <p className="text-center text-sm text-gray-600">
              Ko'rsatilgan kartaga to'lovni amalga oshirgach, "To'ladim" tugmasini bosing.
              Egasining telefoniga tasdiqlash kodi yuboriladi.
            </p>
            <button
              onClick={handlePaid}
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              To'ladim
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Tasdiqlash kodi <span className="font-bold">{maskedPhone}</span> raqamiga yuborildi.
              Egasi aytgan 6 xonali kodni kiriting.
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="______"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-blue-500"
            />
            <button
              onClick={handleVerify}
              disabled={loading || code.length !== 6}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Tasdiqlash
            </button>
            <button
              onClick={handlePaid}
              disabled={loading}
              className="w-full text-center text-sm font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Kodni qayta yuborish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
