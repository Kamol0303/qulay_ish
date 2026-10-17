/** Dialable tel: link for a registration phone. Null when the number cannot be called. */
export function phoneTelHref(phone?: string | null): string | null {
  const cleaned = String(phone || '').trim().replace(/[^\d+]/g, '');
  if (!/^\+?[0-9]{7,15}$/.test(cleaned)) return null;
  return `tel:${cleaned}`;
}
