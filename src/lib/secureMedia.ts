import { API_BASE, getAccessToken } from './api/client';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
};

export function mimeFromMediaUrl(url: string): string | undefined {
  const clean = url.split('?')[0].split('#')[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext];
}

function displayableType(headerType: string, guessed?: string): string | undefined {
  const header = headerType.split(';')[0].trim().toLowerCase();
  if (header.startsWith('image/') || header === 'application/pdf') return header;
  return guessed;
}

/** Fetch private /api/uploads/... URLs with JWT and return a blob object URL. */
export async function resolveSecureMediaUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  const isPrivate =
    url.includes('/api/uploads/private/') || url.includes('/uploads/private/');
  if (!isPrivate) {
    return url.startsWith('/') ? url : `/${url}`;
  }

  let path = url.replace(/^\/uploads\/private\//, '/api/uploads/private/');
  if (/^https?:\/\//i.test(path)) {
    path = path.replace(/^https?:\/\/[^/]+/, '');
  }
  if (!path.startsWith('/api/uploads/private/')) {
    path = path.replace(/^\/uploads\/private\//, '/api/uploads/private/');
  }
  if (API_BASE.startsWith('http')) {
    const apiOrigin = API_BASE.replace(/\/api\/?$/, '');
    path = `${apiOrigin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  const token = getAccessToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return undefined;
  const raw = await res.blob();
  const type = displayableType(res.headers.get('content-type') || raw.type, mimeFromMediaUrl(url));
  const blob = type && type !== raw.type ? new Blob([await raw.arrayBuffer()], { type }) : raw;
  return URL.createObjectURL(blob);
}
