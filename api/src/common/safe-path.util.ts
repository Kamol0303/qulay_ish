import { join, resolve, sep } from 'path';

/** Keep a joined file path inside root. Rejects .. and odd user ids. */
export function safeChildPath(root: string, userId: string, filename: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(userId)) return null;
  if (!/^[A-Za-z0-9._-]{1,180}$/.test(filename) || filename.includes('..')) return null;
  const rootResolved = resolve(root);
  const full = resolve(join(rootResolved, userId, filename));
  if (full !== rootResolved && !full.startsWith(rootResolved + sep)) return null;
  return full;
}
