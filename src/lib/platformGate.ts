export type GateState = 'live' | 'paused' | 'off' | 'removed';

export type GateSections = {
  register: boolean;
  login: boolean;
  workers: boolean;
  jobs: boolean;
  chat: boolean;
  calls: boolean;
  verification: boolean;
  admin: boolean;
  superAdmin: boolean;
};

export const OPEN_SECTIONS: GateSections = {
  register: true,
  login: true,
  workers: true,
  jobs: true,
  chat: true,
  calls: true,
  verification: true,
  admin: true,
  superAdmin: true,
};

/** Admin and super admin screens close. Workers, employers, and the public site stay open. */
export function closedSection(pathname: string, state: GateState, sections: GateSections): boolean {
  const superAdmin = pathname === '/super-admin-login' || pathname.startsWith('/super-admin');
  const admin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (!superAdmin && !admin) return false;
  if (state !== 'live') return true;
  if (admin) return !sections.admin;
  return !sections.superAdmin;
}

export function readGatePayload(value: unknown): { state: GateState; sections: GateSections } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as { state?: unknown; sections?: unknown };
  const state = record.state;
  if (state !== 'live' && state !== 'paused' && state !== 'off' && state !== 'removed') return null;
  const src = record.sections && typeof record.sections === 'object' ? (record.sections as Record<string, unknown>) : {};
  const sections = { ...OPEN_SECTIONS };
  (Object.keys(sections) as (keyof GateSections)[]).forEach((key) => {
    if (src[key] === false) sections[key] = false;
  });
  return { state, sections };
}
