import { resolveApiBase } from './api/client';

/** Origin hosting Nest (no trailing slash), e.g. https://mexrliqollar.uz */
export function resolveApiOrigin(): string {
  const base = resolveApiBase();
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    const { protocol, host } = window.location;
    // Capacitor WebView uses https://localhost — never treat that as API host
    if (host === 'localhost' || host.endsWith('.local') || protocol === 'capacitor:' || protocol === 'ionic:') {
      return 'https://mexrliqollar.uz';
    }
    return window.location.origin;
  }
  return 'https://mexrliqollar.uz';
}
