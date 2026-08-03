import { getAccessToken } from './api/client';

/** Fetch private /api/uploads/... URLs with JWT and return a blob object URL */
export async function resolveSecureMediaUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!url.includes('/api/uploads/private/') && !url.includes('/uploads/private/')) {
    return url.startsWith('/') ? url : `/${url}`;
  }

  const path = url.startsWith('/api/') ? url : url.replace(/^\/uploads\/private\//, '/api/uploads/private/');
  const token = getAccessToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return undefined;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
