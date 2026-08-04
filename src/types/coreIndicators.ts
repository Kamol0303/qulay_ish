/** Worker core development / risk indicators (Асосий индикаторлар) */
export type IndicatorLevel = '' | 'low' | 'medium' | 'high' | 'critical' | 'none' | 'unknown';

export interface WorkerCoreIndicators {
  familyIncome?: string;
  motherSocialStatus?: string;
  educationResults?: string;
  attendance?: string;
  healthStatus?: string;
  psychologicalState?: string;
  disabilityStatus?: string;
  earlyMarriageRisk?: IndicatorLevel | string;
  violenceRisk?: IndicatorLevel | string;
  digitalLiteracy?: string;
  /** Summary risk index / assessment */
  riskAssessment?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByRole?: string;
}

export const CORE_INDICATOR_FIELDS: Array<{
  key: keyof WorkerCoreIndicators;
  label: string;
  kind: 'text' | 'select_risk' | 'textarea';
}> = [
  { key: 'familyIncome', label: 'Оиланинг даромади', kind: 'text' },
  { key: 'motherSocialStatus', label: 'Онанинг ижтимоий ҳолати', kind: 'text' },
  { key: 'educationResults', label: 'Таълим натижалари', kind: 'text' },
  { key: 'attendance', label: 'Давомат', kind: 'text' },
  { key: 'healthStatus', label: 'Соғлиқ ҳолати', kind: 'text' },
  { key: 'psychologicalState', label: 'Психологик ҳолат', kind: 'text' },
  { key: 'disabilityStatus', label: 'Ногиронлик мавжудлиги', kind: 'text' },
  { key: 'earlyMarriageRisk', label: 'Эрта никоҳ хавфи', kind: 'select_risk' },
  { key: 'violenceRisk', label: 'Зўравонлик хавфи', kind: 'select_risk' },
  { key: 'digitalLiteracy', label: 'Рақамли саводхонлик', kind: 'text' },
];

export const RISK_LEVEL_OPTIONS: { value: IndicatorLevel; label: string; tone: string }[] = [
  { value: 'none', label: 'Йўқ / Паст эмас', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'low', label: 'Паст', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'medium', label: 'Ўрта', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'high', label: 'Юқори', tone: 'bg-orange-50 text-orange-800 border-orange-200' },
  { value: 'critical', label: 'Жуда юқори', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'unknown', label: 'Аниқланмаган', tone: 'bg-slate-50 text-slate-600 border-slate-200' },
];

export function riskTone(value?: string): string {
  const found = RISK_LEVEL_OPTIONS.find((o) => o.value === value);
  return found?.tone || 'bg-slate-50 text-slate-700 border-slate-200';
}

export function riskLabel(value?: string): string {
  if (!value) return '—';
  const found = RISK_LEVEL_OPTIONS.find((o) => o.value === value);
  return found?.label || value;
}
