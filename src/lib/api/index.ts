import { apiRequest, setAccessToken, clearAccessToken, toQuery } from './client';
import { ensureArray } from './errors';
import type { Profile, Job, Application, Contract, Notification, ChatMessage, Dispute, VerificationRequest, Review, ServicePost } from '../../types';

export interface AuthResponse {
  accessToken: string;
  user: Profile & { id?: string };
}

function mapUser(u: Record<string, unknown> | null | undefined): Profile | null {
  if (!u || typeof u !== 'object') return null;
  return {
    uid: String(u.id ?? ''),
    fullName: String(u.fullName ?? ''),
    email: String(u.email ?? ''),
    phoneNumber: u.phoneNumber as string | undefined,
    role: u.role as Profile['role'],
    region: String(u.region ?? ''),
    district: u.district as string | undefined,
    neighborhood: u.neighborhood as string | undefined,
    bio: u.bio as string | undefined,
    skills: Array.isArray(u.skills) ? (u.skills as string[]) : [],
    photoUrl: u.photoUrl as string | undefined,
    experienceLevel: u.experienceLevel as string | undefined,
    isPremium: Boolean(u.isPremium),
    isVerified: Boolean(u.isVerified),
    verificationStatus: u.verificationStatus as Profile['verificationStatus'],
    rating: Number(u.rating ?? 0),
    reviewCount: Number(u.reviewCount ?? 0),
    completedJobs: Number(u.completedJobs ?? 0),
    education: u.education as Profile['education'],
    experience: u.experience as Profile['experience'],
    violationCount: Number(u.violationCount ?? 0),
    riskScore: Number(u.riskScore ?? 0),
    isBlocked: Boolean(u.isBlocked),
    blockReason: u.blockReason as string | undefined,
    trustScore: Number(u.trustScore ?? 100),
    behaviorFlags: Array.isArray(u.behaviorFlags) ? (u.behaviorFlags as string[]) : [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastActive: u.lastActive,
  };
}

function mapUsers(rows: unknown): Profile[] {
  return ensureArray<Record<string, unknown>>(rows)
    .map((row) => mapUser(row))
    .filter((user): user is Profile => Boolean(user?.uid));
}

function mapJob(j: Record<string, unknown> | null | undefined): Job | null {
  if (!j || typeof j !== 'object' || j.id == null) return null;
  return { ...(j as unknown as Job), id: String(j.id) };
}

function mapJobs(rows: unknown): Job[] {
  return ensureArray<Record<string, unknown>>(rows)
    .map((row) => mapJob(row))
    .filter((job): job is Job => Boolean(job?.id));
}

export const api = {
  auth: {
    async login(emailOrPhone: string, password: string) {
      const res = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      }, false);
      setAccessToken(res.accessToken);
      const user = mapUser(res.user as unknown as Record<string, unknown>);
      if (!user) throw new Error('Invalid auth response');
      return { ...res, user };
    },
    async superAdminLogin(email: string, password: string) {
      const res = await apiRequest<AuthResponse>('/auth/super-admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, false);
      setAccessToken(res.accessToken);
      const user = mapUser(res.user as unknown as Record<string, unknown>);
      if (!user) throw new Error('Invalid auth response');
      return { ...res, user };
    },
    async me() {
      const u = await apiRequest<Record<string, unknown>>('/auth/me');
      const user = mapUser(u);
      if (!user) throw new Error('Invalid profile response');
      return user;
    },
    logout() {
      clearAccessToken();
    },
    async requestOtp(phoneOrEmail: string, purpose: 'login' | 'register', fullName?: string, role?: Profile['role']) {
      return apiRequest<{ sessionId: string }>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phoneOrEmail, purpose, fullName, role }),
      }, false);
    },
    async verifyOtp(sessionId: string, otp: string) {
      return apiRequest('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ sessionId, otp }),
      }, false);
    },
    async completeRegistration(sessionId: string, data?: { email?: string; phoneNumber?: string }) {
      const res = await apiRequest<AuthResponse>('/auth/otp/complete-registration', {
        method: 'POST',
        body: JSON.stringify({ sessionId, ...data }),
      }, false);
      setAccessToken(res.accessToken);
      const user = mapUser(res.user as unknown as Record<string, unknown>);
      if (!user) throw new Error('Invalid auth response');
      return { ...res, user };
    },
    async completeLogin(sessionId: string) {
      const res = await apiRequest<AuthResponse>('/auth/otp/complete-login', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }, false);
      setAccessToken(res.accessToken);
      const user = mapUser(res.user as unknown as Record<string, unknown>);
      if (!user) throw new Error('Invalid auth response');
      return { ...res, user };
    },
  },

  users: {
    list(params?: { role?: string; region?: string; district?: string }) {
      return apiRequest<unknown>(`/users${toQuery(params ?? {})}`).then(mapUsers);
    },
    get(id: string) {
      return apiRequest<Record<string, unknown>>(`/users/${id}`).then((u) => {
        const user = mapUser(u);
        if (!user) throw new Error('User not found');
        return user;
      });
    },
    update(id: string, data: Partial<Profile>) {
      return apiRequest<Record<string, unknown>>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then((u) => {
        const user = mapUser(u);
        if (!user) throw new Error('User not found');
        return user;
      });
    },
  },

  jobs: {
    list(params?: Record<string, string>) {
      return apiRequest<unknown>(`/jobs${toQuery(params ?? {})}`).then(mapJobs);
    },
    get(id: string) {
      return apiRequest<Job>(`/jobs/${id}`);
    },
    create(data: Partial<Job>) {
      return apiRequest<Job>('/jobs', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Job>) {
      return apiRequest<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  applications: {
    list(params?: Record<string, string>) {
      return apiRequest<Application[]>(`/applications${toQuery(params ?? {})}`).then((rows) => ensureArray<Application>(rows));
    },
    get(id: string) {
      return apiRequest<Application>(`/applications/${id}`);
    },
    create(data: Partial<Application>) {
      return apiRequest<Application>('/applications', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Application>) {
      return apiRequest<Application>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  contracts: {
    list(params?: Record<string, string>) {
      return apiRequest<Contract[]>(`/contracts${toQuery(params ?? {})}`).then((rows) => ensureArray<Contract>(rows));
    },
    get(id: string) {
      return apiRequest<Contract>(`/contracts/${id}`);
    },
    create(data: Partial<Contract>) {
      return apiRequest<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Contract>) {
      return apiRequest<Contract>(`/contracts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  notifications: {
    list(userId: string) {
      return apiRequest<Notification[]>(`/notifications${toQuery({ userId })}`).then((rows) => ensureArray<Notification>(rows));
    },
    create(data: Partial<Notification>) {
      return apiRequest<Notification>('/notifications', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Notification>) {
      return apiRequest<Notification>(`/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  chatMessages: {
    list(userA: string, userB: string) {
      return apiRequest<ChatMessage[]>(`/chat-messages${toQuery({ userA, userB })}`).then((rows) => ensureArray<ChatMessage>(rows));
    },
    create(data: Partial<ChatMessage>) {
      return apiRequest<ChatMessage>('/chat-messages', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<ChatMessage>) {
      return apiRequest<ChatMessage>(`/chat-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  disputes: {
    list(params?: Record<string, string>) {
      return apiRequest<Dispute[]>(`/disputes${toQuery(params ?? {})}`).then((rows) => ensureArray<Dispute>(rows));
    },
    create(data: Partial<Dispute>) {
      return apiRequest<Dispute>('/disputes', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<Dispute>) {
      return apiRequest<Dispute>(`/disputes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  verificationRequests: {
    list(params?: Record<string, string>) {
      return apiRequest<VerificationRequest[]>(`/verification-requests${toQuery(params ?? {})}`).then((rows) => ensureArray<VerificationRequest>(rows));
    },
    create(data: Partial<VerificationRequest>) {
      return apiRequest<VerificationRequest>('/verification-requests', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<VerificationRequest>) {
      return apiRequest<VerificationRequest>(`/verification-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  reviews: {
    list(params?: Record<string, string>) {
      return apiRequest<Review[]>(`/reviews${toQuery(params ?? {})}`).then((rows) => ensureArray<Review>(rows));
    },
    create(data: Partial<Review>) {
      return apiRequest<Review>('/reviews', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  savedJobs: {
    list(userId: string) {
      return apiRequest<Array<{ id: string; userId: string; jobId: string; job?: Job }>>(`/saved-jobs${toQuery({ userId })}`).then((rows) => ensureArray<{ id: string; userId: string; jobId: string; job?: Job }>(rows));
    },
    create(userId: string, jobId: string) {
      return apiRequest('/saved-jobs', { method: 'POST', body: JSON.stringify({ userId, jobId }) });
    },
    remove(userId: string, jobId: string) {
      return apiRequest('/saved-jobs/delete', { method: 'POST', body: JSON.stringify({ userId, jobId }) });
    },
  },

  servicePosts: {
    list(params?: Record<string, string>) {
      return apiRequest<ServicePost[]>(`/service-posts${toQuery(params ?? {})}`).then((rows) => ensureArray<ServicePost>(rows));
    },
    create(data: Partial<ServicePost>) {
      return apiRequest<ServicePost>('/service-posts', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<ServicePost>) {
      return apiRequest<ServicePost>(`/service-posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  payments: {
    list(userId?: string) {
      return apiRequest(`/payments${toQuery({ userId })}`);
    },
    create(data: Record<string, unknown>) {
      return apiRequest('/payments', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Record<string, unknown>) {
      return apiRequest(`/payments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  violations: {
    create(data: Record<string, unknown>) {
      return apiRequest('/violations', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  activityLogs: {
    list(userId?: string) {
      return apiRequest(`/activity-logs${toQuery({ userId })}`);
    },
    create(data: Record<string, unknown>) {
      return apiRequest('/activity-logs', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  systemLogs: {
    list() {
      return apiRequest('/system-logs');
    },
    create(data: Record<string, unknown>) {
      return apiRequest('/system-logs', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  settings: {
    getGlobal() {
      return apiRequest<Record<string, unknown>>('/settings/global');
    },
    updateGlobal(data: Record<string, unknown>) {
      return apiRequest('/settings/global', { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  stats: {
    counts() {
      return apiRequest<{ users: number; jobs: number; applications: number; contracts: number }>(
        '/stats/counts',
        {},
        false,
      ).then((data) => ({
        users: Number(data?.users ?? 0),
        jobs: Number(data?.jobs ?? 0),
        applications: Number(data?.applications ?? 0),
        contracts: Number(data?.contracts ?? 0),
      }));
    },
  },
};
