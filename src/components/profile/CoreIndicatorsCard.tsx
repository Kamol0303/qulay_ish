import { useEffect, useState } from 'react';
import { AlertTriangle, HeartPulse, Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { WorkerCoreIndicators } from '../../types/coreIndicators';
import {
  CORE_INDICATOR_FIELDS,
  RISK_LEVEL_OPTIONS,
  riskLabel,
  riskTone,
} from '../../types/coreIndicators';
import { ProfileCard } from './ProfileCard';

function emptyIndicators(): WorkerCoreIndicators {
  return {
    familyIncome: '',
    motherSocialStatus: '',
    educationResults: '',
    attendance: '',
    healthStatus: '',
    psychologicalState: '',
    disabilityStatus: '',
    earlyMarriageRisk: '',
    violenceRisk: '',
    digitalLiteracy: '',
    riskAssessment: '',
  };
}

function StatusBadge({ value, kind }: { value?: string; kind: 'text' | 'select_risk' | 'textarea' }) {
  if (!value?.trim()) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        —
      </span>
    );
  }
  if (kind === 'select_risk') {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${riskTone(value)}`}
      >
        {riskLabel(value)}
      </span>
    );
  }
  return <p className="text-sm font-semibold text-slate-800">{value}</p>;
}

export function CoreIndicatorsCard({
  userId,
  value,
  editable,
  embedded = false,
  className = '',
}: {
  userId: string;
  /** Prefetched value (e.g. from public profile GET). */
  value?: WorkerCoreIndicators | null;
  editable: boolean;
  /** Softer shell when embedded in public profile card. */
  embedded?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<WorkerCoreIndicators>(value || emptyIndicators());
  const [loading, setLoading] = useState(!value && Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (value) {
      setData({ ...emptyIndicators(), ...value });
      setLoading(false);
      return;
    }
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    api.users
      .getCoreIndicators(userId)
      .then((res) => {
        if (!cancelled) {
          setData({ ...emptyIndicators(), ...(res.coreIndicators || {}) });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Yuklashda xatolik');
          setData(emptyIndicators());
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, value]);

  const setField = (key: keyof WorkerCoreIndicators, v: string) => {
    setData((prev) => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    if (!editable || !userId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: WorkerCoreIndicators = { ...data };
      delete payload.updatedAt;
      delete payload.updatedBy;
      delete payload.updatedByRole;
      const saved = await api.users.updateCoreIndicators(userId, payload);
      setData({ ...emptyIndicators(), ...(saved.coreIndicators || payload) });
      setSuccess('Saqlandi');
      window.setTimeout(() => setSuccess(''), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <>
      {loading ? (
        <p className="text-sm text-slate-500">Asosiy indikatorlar yuklanmoqda…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {CORE_INDICATOR_FIELDS.map((field) => (
              <div
                key={field.key}
                className="rounded-xl border border-slate-100 bg-white/80 px-3.5 py-3"
              >
                <div className="mb-1.5 text-xs font-medium text-slate-500">{field.label}</div>
                {editable ? (
                  field.kind === 'select_risk' ? (
                    <select
                      value={(data[field.key] as string) || ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Tanlang</option>
                      {RISK_LEVEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={(data[field.key] as string) || ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="—"
                    />
                  )
                ) : (
                  <StatusBadge
                    value={data[field.key] as string | undefined}
                    kind={field.kind}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-amber-900">Рискни баҳолаш</div>
                <p className="mt-0.5 text-xs text-amber-800/90">
                  Ҳар бир қиз учун хавф индекси аниқланади.
                </p>
                {editable ? (
                  <select
                    value={data.riskAssessment || ''}
                    onChange={(e) => setField('riskAssessment', e.target.value)}
                    className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 sm:w-auto"
                  >
                    <option value="">Tanlang</option>
                    {RISK_LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="mt-2">
                    {RISK_LEVEL_OPTIONS.some((o) => o.value === data.riskAssessment) ? (
                      <StatusBadge value={data.riskAssessment} kind="select_risk" />
                    ) : (
                      <p className="text-sm font-medium text-amber-950">
                        {(data.riskAssessment || '').trim() || '—'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {editable ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saqlanmoqda…' : 'Indikatorlarni saqlash'}
              </button>
              {success ? (
                <span className="text-sm font-medium text-emerald-600">{success}</span>
              ) : null}
              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          ) : error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}
        </>
      )}
    </>
  );

  if (embedded) {
    return (
      <div
        className={`rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 ${className}`}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Асосий индикаторлар</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {editable
                ? 'Faqat Super Admin tahrirlashi mumkin.'
                : 'Ko‘rish uchun — tahrirlash faqat Super Admin orqali.'}
            </p>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <ProfileCard
      title="Асосий индикаторлар"
      description={
        editable
          ? 'Faqat Super Admin tahrirlashi mumkin.'
          : 'Ko‘rish uchun — tahrirlash faqat Super Admin orqali.'
      }
      className={className}
    >
      {body}
    </ProfileCard>
  );
}
