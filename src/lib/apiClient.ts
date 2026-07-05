const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return 'So\'rov muvaffaqiyatsiz';
  }
  const record = body as Record<string, unknown>;
  if (typeof record.message === 'string') {
    return record.message;
  }
  if (Array.isArray(record.message)) {
    return record.message.map(String).join(', ');
  }
  return 'So\'rov muvaffaqiyatsiz';
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    throw new ApiError(extractErrorMessage(record), res.status, record);
  }

  return body as T;
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
