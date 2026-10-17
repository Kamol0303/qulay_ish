import { join, resolve, sep } from 'path';

/** Keep a joined file path inside root. Rejects .. and odd user ids. */
/** In-app links only. Blocks external URLs and protocol-relative paths. */
export function isSafeAppPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return false;
  if (value.includes('://') || value.toLowerCase().includes('javascript:')) return false;
  return /^\/[A-Za-z0-9/_\-.?=&%#]*$/.test(value) && value.length <= 300;
}

export function safeChildPath(root: string, userId: string, filename: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId)) return null;
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(filename) || filename.includes('..')) return null;
  const rootResolved = resolve(root);
  const full = resolve(join(rootResolved, userId, filename));
  if (full !== rootResolved && !full.startsWith(rootResolved + sep)) return null;
  return full;
}
