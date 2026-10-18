import { OWNER_PATH } from './owner.constants';

export const SECTION_KEYS = [
  'register',
  'login',
  'workers',
  'jobs',
  'chat',
  'calls',
  'verification',
  'admin',
  'superAdmin',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];
export type GateSections = Record<SectionKey, boolean>;
export type GateState = 'live' | 'paused' | 'off' | 'removed';
export type GateBilling = 'free' | 'paid';

export type GateSnapshot = {
  state: GateState;
  billing: GateBilling;
  sections: GateSections;
};

export type AccessDecision =
  | { allow: true }
  | { allow: false; status: number; message: string };

const ALLOWED = new Set(['/api/health', '/api/gate']);

export function allSectionsOn(): GateSections {
  return {
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
}

export function defaultSnapshot(): GateSnapshot {
  return { state: 'live', billing: 'paid', sections: allSectionsOn() };
}

export function normalizeState(value: unknown): GateState {
  if (value === 'paused' || value === 'off' || value === 'removed' || value === 'live') return value;
  return 'live';
}

export function normalizeBilling(value: unknown): GateBilling {
  return value === 'free' ? 'free' : 'paid';
}

export function normalizeSections(value: unknown): GateSections {
  const src = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const sections = allSectionsOn();
  for (const key of SECTION_KEYS) {
    if (src[key] === false) sections[key] = false;
  }
  return sections;
}

export function otpPurposeAllowed(purpose: string, sections: GateSections): boolean {
  if (purpose === 'register') return sections.register;
  return sections.login;
}

function sessionPath(path: string): boolean {
  return path === '/api/auth/me' || path === '/api/auth/logout' || path === '/api/auth/refresh';
}

function closed(message: string, status = 403): AccessDecision {
  return { allow: false, status, message };
}

export function decideAccess(input: {
  path: string;
  method: string;
  role: string | null;
  userId: string | null;
  state: GateState;
  sections: GateSections;
}): AccessDecision {
  const path = (input.path || '/').split('?')[0];
  const method = (input.method || 'GET').toUpperCase();

  if (path === OWNER_PATH || path.startsWith(`${OWNER_PATH}/`)) return { allow: true };
  if (ALLOWED.has(path)) return { allow: true };

  if (input.state === 'removed') return closed('Sahifa topilmadi.', 404);
  if (input.state === 'paused') return closed('Sayt vaqtincha toʻxtatilgan.', 503);
  if (input.state === 'off') return closed('Sayt yopiq.', 503);

  if (!input.sections.login && method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/reset-password')) {
    return closed('Hozir kirib boʻlmaydi.');
  }
  if (!input.sections.superAdmin && path === '/api/auth/super-admin/login') {
    return closed('Hozir kirib boʻlmaydi.');
  }
  if (!input.sections.workers && method === 'GET' && path === '/api/users') {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.workers && method === 'GET' && path.startsWith('/api/users/')) {
    const id = path.slice('/api/users/'.length).split('/')[0];
    if (!input.userId || input.userId !== id) return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.workers && path.startsWith('/api/employer/workers')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.workers && path.startsWith('/api/service-posts')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.jobs && path.startsWith('/api/jobs')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.chat && path.startsWith('/api/chat-messages')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.verification && path.startsWith('/api/verification-requests')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.admin && (path.startsWith('/api/admin/users') || path.startsWith('/api/admin/export'))) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (!input.sections.superAdmin && path.startsWith('/api/admin/subscription')) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (input.role === 'admin' && !input.sections.admin && !sessionPath(path)) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  if (input.role === 'super_admin' && !input.sections.superAdmin && !sessionPath(path)) {
    return closed('Bu boʻlim hozir yopiq.');
  }
  return { allow: true };
}
