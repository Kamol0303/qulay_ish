import { apiRequest, setAccessToken, clearAccessToken, toQuery, API_BASE, getAccessToken } from './client';
import { ensureArray } from './errors';
import type { Profile, Job, Application, Contract, Notification, ChatMessage, ChatThread, Dispute, VerificationRequest, Review, ServicePost, WorkerPersonalInfo, WorkerCoreIndicators } from '../../types';

export interface AuthResponse {
  accessToken: string;
  user: Profile & { id?: string };
}

export interface EmployerWorker {
  uid: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  photoUrl: string | null;
  phoneNumber: string | null;
  region: string;
  district: string | null;
  skills: string[];
  availability: string | null;
  experienceLevel: string | null;
  isVerified: boolean;
  rating: number;
  lookingForWork: boolean;
  distanceKm?: number;
  distanceLabel?: string;
}

export interface AiMatchWorker {
  uid: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  photoUrl: string | null;
  phoneNumber: string | null;
  region: string;
  district: string | null;
  skills: string[];
  experienceLevel: string | null;
  isVerified: boolean;
  rating: number;
  matchScore: number;
  matchedSkills: string[];
  distanceKm?: number;
  distanceLabel?: string;
}

export type SubscriptionStatusValue = 'active' | 'grace' | 'expired';

export interface SubscriptionStatusResponse {
  status: SubscriptionStatusValue;
  freeUntil: string | null;
  paidUntil: string | null;
  effectiveUntil: string | null;
  lastPaymentAt: string | null;
  priceSom: number;
  daysRemaining: number;
  graceDaysRemaining: number;
  inWarningWindow: boolean;
  blocked: boolean;
  priceRange: { min: number; max: number };
  warningDays: number;
  graceDays: number;
  blockedPaths: string[];
}

export interface EmployerWorkersResponse {
  data: EmployerWorker[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  radiusKm?: number;
}

export interface AdminStaffUser {
  uid: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: 'admin' | 'super_admin';
  isVerified: boolean;
  isBlocked: boolean;
  createdAt: string;
}

export interface JobsNearbyResponse {
  data: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  radiusKm?: number;
}

function stringifyParams(
  params?: Record<string, string | number | undefined> | null,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    out[k] = v === undefined ? undefined : String(v);
  }
  return out;
}

function asJsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

function mapUser(u: Record<string, unknown> | null | undefined): Profile | null {
  if (!u || typeof u !== 'object') return null;
  return {
    uid: String(u.id ?? ''),
    fullName: String(u.fullName ?? ''),
    firstName: (u.firstName as string | undefined) ?? undefined,
    lastName: (u.lastName as string | undefined) ?? undefined,
    email: String(u.email ?? ''),
    phoneNumber: u.phoneNumber as string | undefined,
    role: u.role as Profile['role'],
    region: String(u.region ?? ''),
    district: u.district as string | undefined,
    neighborhood: u.neighborhood as string | undefined,
    bio: u.bio as string | undefined,
    personalInfo: u.personalInfo
      ? (u.personalInfo as WorkerPersonalInfo)
      : undefined,
    coreIndicators: u.coreIndicators
      ? (u.coreIndicators as WorkerCoreIndicators)
      : undefined,
    skills: Array.isArray(u.skills) ? (u.skills as string[]) : [],
    profession: u.profession as string | undefined,
    educationLevel: u.educationLevel as string | undefined,
    photoUrl: u.photoUrl as string | undefined,
    coverUrl: u.coverUrl as string | undefined,
    telegram: u.telegram as string | undefined,
    languages: asJsonArray<string>(u.languages),
    availability: (u.availability as Profile['availability']) || 'available',
    lookingForWork: u.lookingForWork !== false,
    professionalSummary: u.professionalSummary as string | undefined,
    preferredContact: u.preferredContact as Profile['preferredContact'],
    experienceLevel: u.experienceLevel as string | undefined,
    isPremium: Boolean(u.isPremium),
    isVerified: Boolean(u.isVerified),
    verificationStatus: u.verificationStatus as Profile['verificationStatus'],
    rating: Number(u.rating ?? 0),
    reviewCount: Number(u.reviewCount ?? 0),
    completedJobs: Number(u.completedJobs ?? 0),
    education: asJsonArray(u.education),
    experience: asJsonArray(u.experience),
    certificates: asJsonArray(u.certificates),
    portfolio: asJsonArray(u.portfolio),
    resumeTemplate: (u.resumeTemplate as Profile['resumeTemplate']) || 'professional',
    companyName: u.companyName as string | undefined,
    businessType: u.businessType as string | undefined,
    industry: u.industry as string | undefined,
    registrationNumber: u.registrationNumber as string | undefined,
    tin: u.tin as string | undefined,
    website: u.website as string | undefined,
    foundedYear: u.foundedYear as string | undefined,
    employeeCount: u.employeeCount as string | undefined,
    officeAddress: u.officeAddress as string | undefined,
    companyGallery: asJsonArray(u.companyGallery),
    companyDocuments: asJsonArray(u.companyDocuments),
    recruiterContacts: asJsonArray(u.recruiterContacts),
    violationCount: Number(u.violationCount ?? 0),
    riskScore: Number(u.riskScore ?? 0),
    isBlocked: Boolean(u.isBlocked),
    blockReason: u.blockReason as string | undefined,
    trustScore: Number(u.trustScore ?? 100),
    behaviorFlags: Array.isArray(u.behaviorFlags) ? (u.behaviorFlags as string[]) : [],
    createdAt: u.createdAt as string | Date | undefined,
    updatedAt: u.updatedAt as string | Date | undefined,
    lastActive: u.lastActive as string | Date | undefined,
    latitude: typeof u.latitude === 'number' ? u.latitude : undefined,
    longitude: typeof u.longitude === 'number' ? u.longitude : undefined,
    locationUpdatedAt: u.locationUpdatedAt as string | Date | undefined,
    locationSharingEnabled: Boolean(u.locationSharingEnabled),
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
    async register(params: {
      phone: string;
      password: string;
      fullName: string;
      role: 'worker' | 'employer';
      email?: string;
    }) {
      const res = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: params.phone,
          phoneNumber: params.phone,
          password: params.password,
          fullName: params.fullName,
          role: params.role,
          email: params.email,
        }),
      }, false);
      setAccessToken(res.accessToken);
      const user = mapUser(res.user as unknown as Record<string, unknown>);
      if (!user) throw new Error('Invalid auth response');
      return { ...res, user };
    },
    async superAdminLogin(login: string, password: string) {
      const res = await apiRequest<AuthResponse>('/auth/super-admin/login', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
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
    /**
     * Slide the session forward without re-authenticating (no OTP/SMS). Stores the
     * fresh token so the user stays logged in across app restarts. Returns the
     * mapped profile, or null if the server didn't return a new token.
     */
    async refresh() {
      const res = await apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' });
      if (res.accessToken) setAccessToken(res.accessToken);
      const user = res.user ? mapUser(res.user as unknown as Record<string, unknown>) : null;
      return user;
    },
    logout() {
      clearAccessToken();
    },
    async sendOtp(params: {
      phone: string;
      purpose?: 'login' | 'register' | 'reset';
      fullName?: string;
      firstName?: string;
      lastName?: string;
      role?: Profile['role'];
      password?: string;
      profession?: string;
      educationLevel?: string;
      district?: string;
    }) {
      return apiRequest<{ success: true }>('/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify(params),
      }, false);
    },
    async verifyOtp(phone: string, code: string) {
      const res = await apiRequest<
        AuthResponse & { success?: boolean; purpose?: string; resetAllowed?: boolean }
      >('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      }, false);
      // Password-reset OTP must not create a login session
      if (res.accessToken) {
        setAccessToken(res.accessToken);
      }
      const user = res.user
        ? mapUser(res.user as unknown as Record<string, unknown>)
        : null;
      return { ...res, user };
    },
    async resetPassword(phone: string, newPassword: string) {
      return apiRequest<{ success: true; message?: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ phone, newPassword }),
      }, false);
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
      // Never send personalInfo / coreIndicators through generic profile patch
      const { personalInfo: _pi, coreIndicators: _ci, ...safe } = data;
      return apiRequest<Record<string, unknown>>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(safe),
      }).then((u) => {
        const user = mapUser(u);
        if (!user) throw new Error('User not found');
        return user;
      });
    },
    getPersonalInfo(id: string) {
      return apiRequest<{ personalInfo: WorkerPersonalInfo | null }>(
        `/users/${id}/personal-info`,
      );
    },
    updatePersonalInfo(id: string, personalInfo: WorkerPersonalInfo) {
      return apiRequest<{ personalInfo: WorkerPersonalInfo | null }>(
        `/users/${id}/personal-info`,
        {
          method: 'PUT',
          body: JSON.stringify({ personalInfo }),
        },
      );
    },
    getCoreIndicators(id: string) {
      return apiRequest<{ coreIndicators: WorkerCoreIndicators | null }>(
        `/users/${id}/core-indicators`,
      );
    },
    updateCoreIndicators(id: string, coreIndicators: WorkerCoreIndicators) {
      return apiRequest<{ coreIndicators: WorkerCoreIndicators | null }>(
        `/users/${id}/core-indicators`,
        {
          method: 'PUT',
          body: JSON.stringify({ coreIndicators }),
        },
      );
    },
    updateLocation(id: string, body: { latitude?: number; longitude?: number; enabled?: boolean }) {
      return apiRequest<{ locationSharingEnabled: boolean; locationUpdatedAt: string | null }>(
        `/users/${id}/location`,
        { method: 'PUT', body: JSON.stringify(body) },
      );
    },
    clearLocation(id: string) {
      return apiRequest<{ locationSharingEnabled: boolean }>(`/users/${id}/location`, {
        method: 'DELETE',
      });
    },
  },

  ai: {
    status() {
      return apiRequest<{ live: boolean; provider: string }>('/ai/status');
    },
    vacancy(body: {
      title?: string;
      category?: string;
      description?: string;
      requirements?: string[];
      region?: string;
      salary?: number | string;
      language?: string;
    }) {
      return apiRequest<{ text: string; provider: string }>('/ai/employer/vacancy', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    match(body: {
      profession?: string;
      skills?: string[];
      region?: string;
      lat?: number;
      lng?: number;
      radiusKm?: number;
      limit?: number;
    }) {
      return apiRequest<{ data: AiMatchWorker[]; total: number; aiProvider: string }>(
        '/ai/employer/match',
        { method: 'POST', body: JSON.stringify(body) },
      );
    },
    resume(body?: { userId?: string; language?: string }) {
      return apiRequest<{ text: string; provider: string }>('/ai/worker/resume', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
    },
    riskSummary(userId: string, language?: string) {
      return apiRequest<{ text: string; provider: string; advisory: boolean }>(
        `/ai/admin/risk-summary/${userId}`,
        { method: 'POST', body: JSON.stringify({ language }) },
      );
    },
  },

  subscription: {
    status() {
      return apiRequest<SubscriptionStatusResponse>('/admin/subscription/status');
    },
    setPrice(priceSom: number) {
      return apiRequest<SubscriptionStatusResponse>('/admin/subscription/price', {
        method: 'POST',
        body: JSON.stringify({ priceSom }),
      });
    },
    pay() {
      return apiRequest<{ cardNumber: string; amount: number }>('/admin/subscription/pay', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    requestOtp() {
      return apiRequest<{ sent: true; maskedPhone: string; expiresInMs: number }>(
        '/admin/subscription/paid',
        { method: 'POST', body: JSON.stringify({}) },
      );
    },
    verifyOtp(code: string) {
      return apiRequest<SubscriptionStatusResponse>('/admin/subscription/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
  },

  admin: {
    /** Streams a server-generated .xlsx of users and triggers a browser download. */
    async exportUsersXlsx(params?: {
      role?: string;
      region?: string;
      district?: string;
      verificationStatus?: string;
      search?: string;
      ids?: string[];
    }) {
      const query = stringifyParams({
        role: params?.role,
        region: params?.region,
        district: params?.district,
        verificationStatus: params?.verificationStatus,
        search: params?.search,
        ids: params?.ids?.length ? params.ids.join(',') : undefined,
      });
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/admin/export/users.xlsx${toQuery(query)}`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let message = `Export ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : String(body.message);
        } catch {
          /* non-JSON error body */
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || `users-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return { filename };
    },
  },

  employer: {
    workers(params?: {
      search?: string;
      region?: string;
      district?: string;
      skill?: string;
      page?: number;
      pageSize?: number;
      nearDistrict?: string;
    }) {
      return apiRequest<EmployerWorkersResponse>(`/employer/workers${toQuery(stringifyParams(params))}`);
    },
    workersNearby(params: {
      lat: number;
      lng: number;
      radius_km?: number;
      skill?: string;
      region?: string;
      page?: number;
      pageSize?: number;
    }) {
      return apiRequest<EmployerWorkersResponse>(`/employer/workers/nearby${toQuery(stringifyParams(params))}`);
    },
  },

  uploads: {
    async upload(
      file: File,
      kind:
        | 'photo'
        | 'cover'
        | 'certificate'
        | 'portfolio'
        | 'document'
        | 'file'
        | 'verification'
        | 'verification_id'
        | 'verification_selfie'
        | 'verification_address'
        | 'verification_extra' = 'file',
    ) {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      const token = (await import('./client')).getAccessToken();
      const base = (await import('./client')).API_BASE;
      const res = await fetch(`${base}/uploads`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const raw = await res.text();
      let body: unknown = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      if (!res.ok) {
        const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
        const msg = record?.message;
        const message = Array.isArray(msg)
          ? msg.map(String).join(', ')
          : typeof msg === 'string'
            ? msg
            : typeof body === 'string' && body
              ? body
              : `Upload ${res.status}`;
        throw new Error(message);
      }
      return body as {
        success: true;
        url: string;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        kind: string;
      };
    },
  },

  jobs: {
    list(params?: Record<string, string>) {
      return apiRequest<unknown>(`/jobs${toQuery(params ?? {})}`).then(mapJobs);
    },
    nearby(params: {
      lat: number;
      lng: number;
      radius_km?: number;
      category?: string;
      region?: string;
      page?: number;
      pageSize?: number;
    }) {
      return apiRequest<JobsNearbyResponse>(`/jobs/nearby${toQuery(stringifyParams(params))}`).then(
        (res) => ({ ...res, data: mapJobs(res.data) }),
      );
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
    complete(id: string) {
      return apiRequest<Application>(`/applications/${id}/complete`, { method: 'POST' });
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
    createFromApplication(
      applicationId: string,
      data: { amount?: number; terms?: string; startDate?: string; endDate?: string },
    ) {
      return apiRequest<Contract>(`/contracts/from-application/${applicationId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
    inbox() {
      return apiRequest<ChatThread[]>('/chat-messages/inbox').then((rows) => ensureArray<ChatThread>(rows));
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
      return apiRequest<unknown>(`/verification-requests${toQuery(params ?? {})}`).then((rows) =>
        ensureArray<VerificationRequest & { user?: Record<string, unknown> }>(rows).map((row) => ({
          ...row,
          user: row.user ? mapUser(row.user) || undefined : undefined,
        })),
      );
    },
    mine() {
      return apiRequest<VerificationRequest | null>('/verification-requests/mine');
    },
    create(data: Partial<VerificationRequest>) {
      return apiRequest<VerificationRequest>('/verification-requests', { method: 'POST', body: JSON.stringify(data) });
    },
    update(id: string, data: Partial<VerificationRequest> & { action?: string }) {
      return apiRequest<VerificationRequest>(`/verification-requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    bulk(data: { ids: string[]; action: 'approve' | 'reject'; rejectionReason?: string; reason?: string }) {
      return apiRequest<{ success: true; count: number }>('/verification-requests/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ids: data.ids,
          action: data.action,
          reason: data.rejectionReason || data.reason,
        }),
      });
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

  adminUsers: {
    list() {
      return apiRequest<AdminStaffUser[]>('/admin/users');
    },
    create(data: {
      fullName: string;
      phone: string;
      password: string;
      role?: 'admin' | 'super_admin';
      email?: string;
    }) {
      return apiRequest<AdminStaffUser>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    resetPassword(id: string, password: string) {
      return apiRequest<{ success: true }>(`/admin/users/${id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
    },
    remove(id: string) {
      return apiRequest<{ success: true }>(`/admin/users/${id}`, { method: 'DELETE' });
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
