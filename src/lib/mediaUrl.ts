import { resolveApiOrigin } from './apiOrigin';

/** Resolve API-hosted upload paths for <img src> / links (absolute on native). */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const origin = resolveApiOrigin();
  if (path.startsWith('/uploads/')) return `${origin}${path}`;
  if (path.startsWith('uploads/')) return `${origin}/${path}`;
  return path;
}

export function avatarFallback(name: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=1e3a5f&color=fff&size=256`;
}
