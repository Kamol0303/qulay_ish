import * as fs from 'fs';
import * as path from 'path';

export type FirestoreTimestamp = {
  _seconds?: number;
  _nanoseconds?: number;
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const ts = value as FirestoreTimestamp & { toDate?: () => Date };
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  }
  return null;
}

export function toDateOrNow(value: unknown): Date {
  return toDate(value) ?? new Date();
}

export function normalizeRegion(region: unknown): string {
  if (typeof region !== 'string' || !region.trim()) return '';
  if (region === 'Samarqand') return 'Samarqand viloyati';
  return region;
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

export function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function readExportFile(exportDir: string, collection: string): Array<{ id: string; data: Record<string, unknown> }> {
  const filePath = path.join(exportDir, `${collection}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[seed] Missing export file: ${collection}.json`);
    return [];
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
    documents?: Array<{ id: string; data: Record<string, unknown> }>;
  };
  return raw.documents ?? [];
}

export function readSingleDocExport(exportDir: string, collection: string, docId: string): Record<string, unknown> | null {
  const filePath = path.join(exportDir, collection, `${docId}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { data?: Record<string, unknown> };
  return raw.data ?? null;
}

export function mapEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
