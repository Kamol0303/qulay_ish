import { useState } from 'react';
import { Sparkles, Loader, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/api';

/** Super Admin-only AI advisory summary of a worker's risk indicators (PII anonymized server-side). */
export function RiskSummaryAiCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function handleSummary() {
    setLoading(true);
    setError('');
    try {
      const res = await api.ai.riskSummary(userId, 'uz');
      setText(res.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-600" />
          <h3 className="font-bold text-gray-900">AI xavf xulosasi (maslahat)</h3>
        </div>
        <button
          type="button"
          onClick={handleSummary}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-200 disabled:opacity-50"
        >
          {loading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Xulosa olish
        </button>
      </div>
      <p className="mb-3 text-xs text-amber-800">
        Faqat maslahat uchun. Yakuniy qarorni inson qabul qiladi. Shaxsiy ma'lumotlar anonimlashtiriladi.
      </p>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {text && (
        <div className="whitespace-pre-wrap rounded-xl bg-white p-4 text-sm leading-relaxed text-gray-800">
          {text}
        </div>
      )}
    </div>
  );
}
