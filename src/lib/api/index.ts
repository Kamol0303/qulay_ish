import { apiRequest, setAccessToken, clearAccessToken, toQuery } from './client';
import type { Profile, Job, Application, Contract, Notification, ChatMessage, Dispute, VerificationRequest, Review, ServicePost } from '../../types';

export interface AuthResponse {
  accessToken: string;
  user: Profile & { id?: string };
}

function mapUser(u: Record<string, unknown>): Profile {
  return {
    uid: String(u.id),
    fullName: String(u.fullName ?? ''),
    email: String(u.email ?? ''),
    phoneNumber: u.phoneNumber as string | undefined,
    role: u.role as Profile['role'],
    region: String(u.region ?? ''),
    district: u.district as string | undefined,
    neighborhood: u.neighborhood as string | undefined,
    bio: u.bio as string | undefined,
    skills: (u.skills as string[]) ?? [],
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
    behaviorFlags: (u.behaviorFlags as string[]) ?? [],
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastActive: u.lastActive,
  };
}

function mapJob(j: Record<string, unknown>): Job {
  return { ...(j as unknown as Job), id: String(j.id) };
}

export const api = {
  auth: {
    async login(emailOrPhone: string, password: string) {
      const res = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrPhone, password }),
      }, false);
      setAccessToken(res.accessToken);
      return { ...res, user: mapUser(res.user as unknown as Record<string, unknown>) };
    },
    async superAdminLogin(email: string, password: string) {
      const res = await apiRequest<AuthResponse>('/auth/super-admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }, false);
      setAccessToken(res.accessToken);
      return { ...res, user: mapUser(res.user as unknown as Record<string, unknown>) };
    },
    async me() {
      const u = await apiRequest<Record<string, unknown>>('/auth/me');
      return mapUser(u);
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
      return { ...res, user: mapUser(res.user as unknown as Record<string, unknown>) };
    },
    async completeLogin(sessionId: string) {
      const res = await apiRequest<AuthResponse>('/auth/otp/complete-login', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }, false);
      setAccessToken(res.accessToken);
      return { ...res, user: mapUser(res.user as unknown as Record<string, unknown>) };
    },
  },

  users: {
    list(params?: { role?: string; region?: string }) {
      return apiRequest<Profile[]>(`/users${toQuery(params ?? {})}`).then((rows) =>
        rows.map((r) => mapUser(r as unknown as Record<string, unknown>))
      );
    },
    get(id: string) {
      return apiRequest<Record<string, unknown>>(`/users/${id}`).then(mapUser);
    },
    update(id: string, data: Partial<Profile>) {
      return apiRequest<Record<string, unknown>>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }).then(mapUser);
    },
  },

  jobs: {
    list(params?: Record<string, string>) {
      return apiRequest<Job[]>(`/jobs${toQuery(params)}`).then((rows) => rows.map((r) => mapJob(r as unknown as Record<string, unknown>)));
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
      return apiRequest<Application[]>(`/applications${toQuery(params)}`);
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
      return apiRequest<Contract[]>(`/contracts${toQuery(params)}`);
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
      return apiRequest<Notification[]>(`/notifications${toQuery({ userId })}`);
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
      return apiRequest<ChatMessage[]>(`/chat-messages${toQuery({ userA, userB })}`);
    },
    create(data: Partial<ChatMessage>) {
      return apiRequest<ChatMessage>('/chat-messages', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<ChatMessage>) {
      return apiRequest<ChatMessage>(`/chat-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  disputes: {
    list() {
      return apiRequest<Dispute[]>('/disputes');
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
      return apiRequest<VerificationRequest[]>(`/verification-requests${toQuery(params)}`);
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
      return apiRequest<Review[]>(`/reviews${toQuery(params)}`);
    },
    create(data: Partial<Review>) {
      return apiRequest<Review>('/reviews', { method: 'POST', body: JSON.stringify(data) });
    },
  },

  savedJobs: {
    list(userId: string) {
      return apiRequest<Array<{ id: string; userId: string; jobId: string; job?: Job }>>(`/saved-jobs${toQuery({ userId })}`);
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
      return apiRequest<ServicePost[]>(`/service-posts${toQuery(params)}`);
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
      return apiRequest('/settings/global');
    },
    updateGlobal(data: Record<string, unknown>) {
      return apiRequest('/settings/global', { method: 'PATCH', body: JSON.stringify(data) });
    },
  },

  stats: {
    counts() {
      return apiRequest<{ users: number; jobs: number; applications: number; contracts: number }>('/stats/counts');
    },
  },
};
