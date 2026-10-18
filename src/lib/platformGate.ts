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

const WORKER_APP_PREFIXES = [
  '/worker/dashboard',
  '/worker/applications',
  '/worker/nearby-jobs',
  '/worker/contracts',
  '/worker/service-posts',
  '/worker/create-service',
  '/worker/edit-service',
];

function isWorkerAppPath(pathname: string): boolean {
  return WORKER_APP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Which public part is closed for this address, if any. */
export function closedSection(pathname: string, search: string, sections: GateSections): keyof GateSections | null {
  if (pathname === '/super-admin-login' || pathname.startsWith('/super-admin')) {
    return sections.superAdmin ? null : 'superAdmin';
  }
  if (pathname.startsWith('/admin')) return sections.admin ? null : 'admin';
  if (pathname.startsWith('/chat')) return sections.chat ? null : 'chat';
  if (pathname.startsWith('/verification')) return sections.verification ? null : 'verification';
  if (
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/employer/jobs') ||
    pathname === '/worker/nearby-jobs'
  ) {
    return sections.jobs ? null : 'jobs';
  }
  if (
    pathname === '/workers' ||
    pathname === '/directory' ||
    pathname.startsWith('/employer/nearby-workers') ||
    pathname.startsWith('/employer/worker-services') ||
    (pathname.startsWith('/worker/') && !isWorkerAppPath(pathname))
  ) {
    return sections.workers ? null : 'workers';
  }
  if (pathname === '/login' || pathname.startsWith('/auth')) {
    const mode = new URLSearchParams(search).get('mode');
    if (mode === 'login' || mode === 'forgot') return sections.login ? null : 'login';
    return sections.register ? null : 'register';
  }
  return null;
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
