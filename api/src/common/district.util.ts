import { haversineKm } from './geo.util';
import { findDistrict } from './samarqand-districts';

const UNKNOWN_DISTANCE = Number.POSITIVE_INFINITY;

/**
 * Approximate distance (km) between two Samarqand districts/cities using their
 * centroids. Returns null when either id is unknown (e.g. legacy free-text), so
 * callers can treat it as "no proximity signal".
 */
export function districtDistanceKm(a?: string | null, b?: string | null): number | null {
  const da = findDistrict(a);
  const db = findDistrict(b);
  if (!da || !db) return null;
  if (da.id === db.id) return 0;
  return haversineKm(da.lat, da.lng, db.lat, db.lng);
}

/**
 * Sort key for ranking rows by proximity to `origin`. Same district first, then
 * nearest centroid; rows with an unknown district fall to the end so they never
 * crowd out closer, known matches.
 */
export function districtProximityKey(origin?: string | null, target?: string | null): number {
  const d = districtDistanceKm(origin, target);
  return d == null ? UNKNOWN_DISTANCE : d;
}
