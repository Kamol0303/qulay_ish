/**
 * Lightweight geo helpers (no PostGIS). Haversine great-circle distance plus a
 * bounding-box prefilter so the DB can use a (latitude, longitude) index before
 * the exact distance is computed in JS.
 */

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG_LAT = 111.32;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(
  lat: number,
  lng: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const cos = Math.cos(toRad(lat));
  const lngDelta = radiusKm / (KM_PER_DEG_LAT * (Math.abs(cos) < 1e-6 ? 1e-6 : cos));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - Math.abs(lngDelta),
    maxLng: lng + Math.abs(lngDelta),
  };
}

/**
 * Fuzzed, human-readable distance. Employers never receive exact coordinates or
 * exact distances — only a rounded "~N km" bucket.
 */
export function approxDistanceLabel(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return '~1 km';
  if (km < 10) return `~${Math.round(km)} km`;
  if (km < 50) return `~${Math.round(km / 5) * 5} km`;
  return `~${Math.round(km / 10) * 10} km`;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
