import { useEffect, useState } from 'react';
import { CreditCard, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useSubscription } from '../../context/SubscriptionContext';

function formatSom(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(amount);
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active: { text: 'Faol', cls: 'bg-green-50 text-green-700' },
  grace: { text: 'Imtiyozli davr', cls: 'bg-orange-50 text-orange-700' },
  expired: { text: 'Muddati tugagan', cls: 'bg-red-50 text-red-700' },
};

export default function SubscriptionSettingsCard() {
  const { status, refresh } = useSubscription();
  const [price, setPrice] = useState<number>(status?.priceSom ?? 240000);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status?.priceSom) setPrice(status.priceSom);
  }, [status?.priceSom]);

  const min = status?.priceRange.min ?? 240000;
  const max = status?.priceRange.max ?? 300000;

  async function handleSave() {
    setSaving(true);
    setResult('idle');
    setMessage('');
    try {
      await api.subscription.setPrice(price);
      await refresh();
      setResult('success');
      setTimeout(() => setResult('idle'), 3000);
    } catch (e) {
      setResult('error');
      setMessage(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  const label = status ? STATUS_LABEL[status.status] : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-6">
      <div>
        <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
          <CreditCard size={20} className="text-indigo-500" />
          Obuna va to'lov
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Ishchi va ish beruvchilar uchun bepul. Faqat Super Admin paneli uchun oylik to'lov.
        </p>
      </div>

      {status && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gray-50 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Holat</p>
            {label && (
              <span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${label.cls}`}>
                {label.text}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Amal qilish muddati</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {status.effectiveUntil
                ? new Date(status.effectiveUntil).toLocaleDateString('uz-UZ')
                : '—'}
              {status.status === 'active' && ` (${status.daysRemaining} kun)`}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Joriy narx</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{formatSom(status.priceSom)} so'm</p>
          </div>
        </div>
      )}

      {result === 'success' && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          <CheckCircle size={16} /> Narx saqlandi
        </div>
      )}
      {result === 'error' && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={16} /> {message}
        </div>
      )}

      <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-50/50 rounded-2xl border border-indigo-100">
        <label className="block">
          <p className="text-sm font-black text-gray-900 mb-2">OYLIK TO'LOV NARXI</p>
          <p className="text-xs text-gray-500 mb-3">
            {formatSom(min)} – {formatSom(max)} so'm oralig'ida
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1000}
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value, 10) || min)}
              className="w-40 min-h-[44px] px-4 py-2 border border-indigo-200 rounded-xl text-center font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <span className="text-sm font-medium text-gray-600">so'm / oy</span>
          </div>
        </label>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader size={16} className="animate-spin" /> : null}
          Narxni saqlash
        </button>
      </div>
    </div>
  );
}
