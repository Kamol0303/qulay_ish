function extractApiMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const msg = record.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.map(String).join(', ');
  return null;
}

const TOKEN_KEY = 'qulay_ish_access_token';
const SESSION_PROFILE_KEY = 'qulay_ish_session_profile';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_PROFILE_KEY);
}

/** JWT `exp` in ms, or null if missing/invalid */
export function getAccessTokenExpiryMs(token?: string | null): number | null {
  const value = token ?? getAccessToken();
  if (!value) return null;
  try {
    const part = value.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenValid(token?: string | null): boolean {
  const exp = getAccessTokenExpiryMs(token);
  if (!exp) return false;
  // 30s clock skew buffer
  return Date.now() < exp - 30_000;
}

export function cacheSessionProfile(profile: unknown): void {
  try {
    localStorage.setItem(
      SESSION_PROFILE_KEY,
      JSON.stringify({ profile, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function readCachedSessionProfile<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem(SESSION_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: T };
    return parsed.profile ?? null;
  } catch {
    return null;
  }
}

export function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || '/api').trim();
  if (raw.startsWith('/')) {
    return raw.replace(/\/$/, '') || '/api';
  }
  const withoutTrailing = raw.replace(/\/$/, '');
  return withoutTrailing.endsWith('/api') ? withoutTrailing : `${withoutTrailing}/api`;
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Read body once — Response streams can only be consumed a single time.
  // (Calling res.json() then res.text() throws "Body has already been consumed".)
  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
  }

  if (!res.ok) {
    const message = extractApiMessage(body) ?? (typeof body === 'string' && body ? body : `API ${res.status}`);
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204 || raw === '') return undefined as T;
  return body as T;
}

export function toQuery(params?: Record<string, string | undefined> | null): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
