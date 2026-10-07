/**
 * Canonical, fixed list of Samarqand region districts (tumanlar) and cities
 * (shaharlar). This is the single source of truth used at registration — every
 * worker and buyurtmachi (employer) must pick exactly one of these so we always
 * know, precisely, where each account is located.
 *
 * `lat`/`lng` are approximate district/city centroids used only to rank
 * worker↔buyurtmachi proximity (never exposed as exact coordinates).
 */
export type SamarqandDistrictType = 'city' | 'district';

export type SamarqandDistrict = {
  id: string;
  name: string;
  type: SamarqandDistrictType;
  lat: number;
  lng: number;
};

export const SAMARQAND_DISTRICTS: readonly SamarqandDistrict[] = [
  // Shaharlar (cities)
  { id: 'samarqand_shahri', name: 'Samarqand shahri', type: 'city', lat: 39.6542, lng: 66.9597 },
  { id: 'kattaqorgon_shahri', name: "Kattaqoʻrgʻon shahri", type: 'city', lat: 39.899, lng: 66.2581 },
  { id: 'oqtosh_shahri', name: 'Oqtosh shahri', type: 'city', lat: 39.923, lng: 66.086 },
  { id: 'jomboy_shahri', name: 'Jomboy shahri', type: 'city', lat: 39.7108, lng: 67.03 },
  // Tumanlar (districts)
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

export const SAMARQAND_DISTRICT_IDS: readonly string[] = SAMARQAND_DISTRICTS.map((d) => d.id);

const BY_ID = new Map(SAMARQAND_DISTRICTS.map((d) => [d.id, d]));

export function findDistrict(id?: string | null): SamarqandDistrict | undefined {
  if (!id) return undefined;
  return BY_ID.get(id.trim());
}

export function isValidDistrictId(id?: string | null): boolean {
  return !!id && BY_ID.has(id.trim());
}
