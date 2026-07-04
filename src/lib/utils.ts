import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const normalizeLanguageCode = (lang?: string) => {
  if (!lang) return 'uz';
  const normalized = lang.toLowerCase();
  if (normalized.startsWith('uz')) return 'uz';
  if (normalized.startsWith('ru')) return 'ru';
  if (normalized.startsWith('en')) return 'en';
  return 'uz';
};

export const getDistrictKey = (district?: string) => {
  if (!district) return '';
  const map: Record<string, string> = {
    "Samarqand shahar": "samarkand_city",
    "Urgut": "urgut",
    "Kattaqoʻrgʻon": "kattaqorgon",
    "Pastdargʻom": "pastdargom",
    "Payariq": "payariq",
    "Ishtixon": "ishtixon",
    "Narpay": "narpay",
    "Toyloq": "toyloq",
    "Qoʻshrabot": "qoshrabot",
    "Bulungʻur": "bulungur",
    "Jomboy": "jomboy"
  };
  return map[district] || district.toLowerCase().replace(/ʻ/g, '').replace(/ /g, '_');
};

/** Demo/imported profiles often have empty or alternate Samarkand region labels. */
export function isSamarkandRegion(region?: string | null): boolean {
  if (!region || !region.trim()) return true;
  const value = region.trim().toLowerCase();
  return value.includes('samarqand') || value.includes('samarkand');
}

export function filterWorkersForSamarkand<T extends { region?: string | null; district?: string | null }>(
  workers: T[],
  options?: { district?: string },
): T[] {
  return workers.filter((worker) => {
    if (!isSamarkandRegion(worker.region)) return false;
    if (options?.district && worker.district !== options.district) return false;
    return true;
  });
}
