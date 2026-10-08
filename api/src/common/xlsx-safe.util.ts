export const XLSX_EMPTY = '-';

/**
 * Guard against CSV/formula injection in exported spreadsheets. Any string
 * beginning with = + - @ (or a control char some apps treat as a formula lead)
 * is prefixed with a single quote so it renders as literal text. Empty values
 * become "-".
 */
export function safeCell(value: unknown): string | number {
  if (value == null || value === '') return XLSX_EMPTY;
  if (typeof value === 'number') return Number.isFinite(value) ? value : XLSX_EMPTY;
  if (typeof value === 'boolean') return value ? 'Ha' : "Yo'q";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? XLSX_EMPTY : value.toISOString();
  }
  let s = String(value);
  if (!s.trim()) return XLSX_EMPTY;
  const phone = /^\+\d{7,15}$/.test(s.replace(/[\s()-]/g, ''));
  if (!phone && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s;
}

/** Spreadsheet cell for scalars, lists, and JSON objects the user entered. */
export function formatExportValue(value: unknown): string | number {
  if (Array.isArray(value)) {
    if (!value.length) return XLSX_EMPTY;
    return safeCell(
      value
        .map((item) =>
          item != null && typeof item === 'object' ? JSON.stringify(item) : String(item ?? ''),
        )
        .filter((item) => item.trim())
        .join(', '),
    );
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const record = value as Record<string, unknown>;
    if (!Object.keys(record).length) return XLSX_EMPTY;
    return safeCell(JSON.stringify(record));
  }
  return safeCell(value);
}

/** Map a qualitative risk level to a 0-4 score for the aggregate risk index. */
export const RISK_SCALE: Record<string, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function riskIndex(core: Record<string, unknown> | null | undefined): string | number {
  if (!core) return XLSX_EMPTY;
  const levels = [core.earlyMarriageRisk, core.violenceRisk]
    .map((v) => (v == null ? null : RISK_SCALE[String(v)]))
    .filter((n): n is number => typeof n === 'number');
  if (!levels.length) return XLSX_EMPTY;
  const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
  return Math.round(avg * 100) / 100;
}
