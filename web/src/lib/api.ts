/**
 * Thin fetch wrapper for the PredictDx API.
 *
 * - The access token lives only in memory (never localStorage), so an XSS payload
 *   cannot lift a long-lived credential.
 * - The refresh token is an httpOnly cookie the browser sends to /api/v1/auth only.
 * - On a 401 the client refreshes once, transparently, then retries the request.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<SessionResult | null> | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const whenSessionLost = (fn: () => void) => {
  onSessionLost = fn;
};

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  status: string;
  mfaEnabled: boolean;
  mfaMethod: 'EMAIL' | 'TOTP';
  mfaMandatory: boolean;
  lastLoginAt: string | null;
  patient: { id: string; mrn: string; city: string | null; gender: string | null; dateOfBirth: string | null } | null;
  doctor: { id: string; specialization: string; pmdcNumber: string; hospital: string; verified: boolean } | null;
}

export interface SessionResult {
  status: 'OK';
  accessToken: string;
  user: User;
}

async function parse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export function refreshSession(): Promise<SessionResult | null> {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await parse(res)) as SessionResult;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface Options {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T = any>(path: string, opts: Options = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
      headers,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: 'include',
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'Cannot reach the PredictDx server. Is the backend running?');
  }

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const session = await refreshSession();
    if (session) return api<T>(path, opts, true);
    accessToken = null;
    onSessionLost?.();
  }
  const data = await parse(res);
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : (data?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/** Fetches an authenticated binary (e.g. an X-ray) and returns an object URL. */
export async function blobUrl(path: string) {
  const res = await fetch(`/api/v1${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new ApiError(res.status, 'Could not load the image');
  return URL.createObjectURL(await res.blob());
}
