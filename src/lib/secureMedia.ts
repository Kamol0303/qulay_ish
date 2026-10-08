import { API_BASE, getAccessToken } from './api/client';

/** Fetch private /api/uploads/... URLs with JWT and return a blob object URL */
export async function resolveSecureMediaUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const isPrivate =
    url.includes('/api/uploads/private/') || url.includes('/uploads/private/');
  if (!isPrivate) {
    return url.startsWith('/') ? url : `/${url}`;
  }

  let path = url.replace(/^\/uploads\/private\//, '/api/uploads/private/');
  if (!/^https?:\/\//i.test(path) && API_BASE.startsWith('http')) {
    const apiOrigin = API_BASE.replace(/\/api\/?$/, '');
    path = `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  }
  const token = getAccessToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return undefined;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
