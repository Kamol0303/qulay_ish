/**
 * Canonical, fixed Samarqand region districts (tumanlar) and cities (shaharlar).
 * This is the single list offered at registration — every worker and buyurtmachi
 * must pick exactly one, so we always know precisely where they are.
 *
 * `lat`/`lng` are approximate centroids used to rank worker↔buyurtmachi
 * proximity on the client (nearest-first recommendations).
 */
export type SamarqandDistrict = {
  id: string;
  name: string;
  type: 'city' | 'district';
  lat: number;
  lng: number;
};

export const SAMARQAND_DISTRICTS: SamarqandDistrict[] = [
  { id: 'samarqand_shahri', name: 'Samarqand shahri', type: 'city', lat: 39.6542, lng: 66.9597 },
  { id: 'kattaqorgon_shahri', name: "Kattaqoʻrgʻon shahri", type: 'city', lat: 39.899, lng: 66.2581 },
  { id: 'oqtosh_shahri', name: 'Oqtosh shahri', type: 'city', lat: 39.923, lng: 66.086 },
  { id: 'jomboy_shahri', name: 'Jomboy shahri', type: 'city', lat: 39.7108, lng: 67.03 },
  { id: 'bulungur', name: "Bulungʻur tumani", type: 'district', lat: 39.7667, lng: 67.2667 },
  { id: 'ishtixon', name: 'Ishtixon tumani', type: 'district', lat: 39.9611, lng: 66.4792 },
  { id: 'jomboy', name: 'Jomboy tumani', type: 'district', lat: 39.7108, lng: 67.03 },
  { id: 'kattaqorgon', name: "Kattaqoʻrgʻon tumani", type: 'district', lat: 39.899, lng: 66.255 },
  { id: 'narpay', name: 'Narpay tumani', type: 'district', lat: 39.92, lng: 66.09 },
  { id: 'nurobod', name: 'Nurobod tumani', type: 'district', lat: 39.5, lng: 66.3 },
  { id: 'oqdaryo', name: 'Oqdaryo tumani', type: 'district', lat: 39.83, lng: 66.92 },
  { id: 'pastdargom', name: "Past Dargʻom tumani", type: 'district', lat: 39.72, lng: 66.67 },
  { id: 'paxtachi', name: 'Paxtachi tumani', type: 'district', lat: 40.06, lng: 66.25 },
  { id: 'payariq', name: 'Payariq tumani', type: 'district', lat: 39.91, lng: 66.99 },
  { id: 'qoshrabot', name: "Qoʻshrabot tumani", type: 'district', lat: 40.22, lng: 66.69 },
  { id: 'samarqand_tumani', name: 'Samarqand tumani', type: 'district', lat: 39.6, lng: 67.0 },
  { id: 'toyloq', name: 'Toyloq tumani', type: 'district', lat: 39.58, lng: 67.05 },
  { id: 'urgut', name: 'Urgut tumani', type: 'district', lat: 39.4, lng: 67.24 },
];

export const SAMARQAND_DISTRICT_CITIES = SAMARQAND_DISTRICTS.filter((d) => d.type === 'city');
export const SAMARQAND_DISTRICT_TUMANLAR = SAMARQAND_DISTRICTS.filter((d) => d.type === 'district');

const BY_ID = new Map(SAMARQAND_DISTRICTS.map((d) => [d.id, d]));

export function findDistrict(id?: string | null): SamarqandDistrict | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.trim());
}

export function isValidDistrictId(id?: string | null): boolean {
  return !!id && BY_ID.has(id.trim());
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Approximate km from a GPS point to a district centroid; null when the district is unknown. */
export function pointDistanceKm(lat: number, lng: number, districtId?: string | null): number | null {
  const district = findDistrict(districtId);
  if (!district) return null;
  return haversineKm(lat, lng, district.lat, district.lng);
}

/**
 * All four worker-list filters (cheapest, dearest, nearest, farthest) rank
 * people the same way: closest to the user first, farthest last.
 * Website and APK both use this list, so the two stay in step.
 */
export const DISTANCE_SORTS = ['price-low', 'price-high', 'nearest', 'farthest'] as const;

export type DistanceSort = (typeof DISTANCE_SORTS)[number];

/**
 * Mixed sizes for the four filters. Which button gets which size also
 * shifts with the user's area and with the other active filters.
 */
export const MIXED_FILTER_COUNTS = [10, 5, 50, 30] as const;

export function sortsByDistance(sortBy: string): sortBy is DistanceSort {
  return (DISTANCE_SORTS as readonly string[]).includes(sortBy);
}

function textHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Coarse map cell. The same town stays stable; another district mixes the counts. */
function locationBand(origin: { lat: number; lng: number } | null | undefined): number {
  if (!origin) return 0;
  const latCell = Math.round(origin.lat * 10);
  const lngCell = Math.round(origin.lng * 10);
  return Math.abs(latCell * 31 + lngCell * 7);
}

/** Non-empty extra filters always move the sizes. Empty stays on the base order. */
function scopeShift(scope: string): number {
  const trimmed = scope.replace(/\|/g, '').trim();
  if (!trimmed) return 0;
  return (textHash(trimmed) % (MIXED_FILTER_COUNTS.length - 1)) + 1;
}

/** A known map area always moves the sizes. No location stays on the base order. */
function areaShift(origin: { lat: number; lng: number } | null | undefined): number {
  if (!origin) return 0;
  return (locationBand(origin) % (MIXED_FILTER_COUNTS.length - 1)) + 1;
}

/** One of 10, 5, 50, 30. The four filters never share a size at the same place. */
export function mixedFilterCount(
  sortBy: DistanceSort,
  origin: { lat: number; lng: number } | null | undefined,
  scope = '',
): number {
  const shift = (DISTANCE_SORTS.indexOf(sortBy) + areaShift(origin) + scopeShift(scope)) % MIXED_FILTER_COUNTS.length;
  return MIXED_FILTER_COUNTS[shift];
}

/** Shrink the mixed sizes so they still fit the real list and stay different when they can. */
export function fitMixedCounts(poolSize: number, wants: readonly number[]): number[] {
  const count = wants.length;
  if (poolSize <= 0) return wants.map(() => 0);
  const wantedSum = wants.reduce((sum, size) => sum + size, 0);
  if (poolSize >= wantedSum) return [...wants];

  const fitted = wants.map((size) => Math.max(1, Math.round((size / wantedSum) * poolSize)));
  let used = fitted.reduce((sum, size) => sum + size, 0);
  const largerFirst = fitted.map((_, index) => index).sort((a, b) => wants[b] - wants[a] || a - b);
  while (used > poolSize) {
    const index = largerFirst.find((item) => fitted[item] > 0);
    if (index == null) break;
    fitted[index] -= 1;
    used -= 1;
  }
  while (used < poolSize) {
    fitted[largerFirst[0]] += 1;
    used += 1;
  }
  for (let guard = 0; guard < count; guard += 1) {
    const seen = new Map<number, number>();
    let split = false;
    for (let index = 0; index < count; index += 1) {
      const previous = seen.get(fitted[index]);
      if (previous != null && fitted[index] > 1) {
        fitted[index] -= 1;
        fitted[previous] += 1;
        split = true;
        break;
      }
      seen.set(fitted[index], index);
    }
    if (!split) break;
  }
  return fitted;
}

/** Km used as a sort key. Missing GPS or an unknown district sinks to the bottom. */
export function workerDistanceKm(
  origin: { lat: number; lng: number } | null | undefined,
  districtId?: string | null,
): number {
  if (!origin) return Number.POSITIVE_INFINITY;
  const km = pointDistanceKm(origin.lat, origin.lng, districtId);
  return km == null ? Number.POSITIVE_INFINITY : km;
}

/** Nearest district first. Equal distances keep their previous order. */
export function compareByDistance(
  origin: { lat: number; lng: number } | null | undefined,
  aDistrict?: string | null,
  bDistrict?: string | null,
): number {
  const left = workerDistanceKm(origin, aDistrict);
  const right = workerDistanceKm(origin, bDistrict);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Real workers only. Each of the four filters gets its own mixed count
 * (10, 5, 50 or 30, shifted by area and by the other active filters).
 * Inside the window the closest person stays first. People are not repeated
 * across the four filters when the live list is long enough.
 */
/**
 * A direction or district with only a handful of real people cannot fill
 * 10, 5, 50 and 30. In that case the filters keep using the full live list,
 * so the website and the APK still show a mixed count instead of an empty page.
 */
export function listForMixedFilter<T>(narrowed: readonly T[], everyone: readonly T[], sortBy: string): readonly T[] {
  if (!sortsByDistance(sortBy)) return narrowed.length > 0 ? narrowed : everyone;
  const smallest = Math.min(...MIXED_FILTER_COUNTS);
  if (narrowed.length >= smallest) return narrowed;
  return everyone;
}

export function pickDistanceWindow<T extends { district?: string | null }>(
  workers: readonly T[],
  sortBy: string,
  origin: { lat: number; lng: number } | null | undefined,
  scope = '',
): T[] {
  if (!sortsByDistance(sortBy)) return [...workers];
  const ranked = [...workers].sort((a, b) => compareByDistance(origin, a.district, b.district));
  const wants = DISTANCE_SORTS.map((key) => mixedFilterCount(key, origin, scope));
  const counts = fitMixedCounts(ranked.length, wants);
  const sizeOf = (key: DistanceSort) => counts[DISTANCE_SORTS.indexOf(key)];

  let cursor = 0;
  const frontStart: Partial<Record<DistanceSort, number>> = {};
  for (const key of ['nearest', 'price-low', 'price-high'] as const) {
    frontStart[key] = cursor;
    cursor += sizeOf(key);
  }
  if (sortBy === 'farthest') {
    const size = sizeOf('farthest');
    const start = Math.max(cursor, ranked.length - size);
    return ranked.slice(start, start + size);
  }
  const start = frontStart[sortBy] ?? 0;
  return ranked.slice(start, start + sizeOf(sortBy));
}

/** Approximate km between two canonical districts; null when either is unknown. */
export function districtDistanceKm(a?: string | null, b?: string | null): number | null {
  const da = findDistrict(a);
  const db = findDistrict(b);
  if (!da || !db) return null;
  if (da.id === db.id) return 0;
  return haversineKm(da.lat, da.lng, db.lat, db.lng);
}

/** Sort key: closest first; unknown districts sink to the end. */
export function districtProximityKey(origin?: string | null, target?: string | null): number {
  const d = districtDistanceKm(origin, target);
  return d == null ? Number.POSITIVE_INFINITY : d;
}
