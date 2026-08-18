const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};
const procEnv = (typeof process !== 'undefined' && (process as any).env) || {};

// Dynamically resolve the backend host from the browser's current hostname.
// This means:
//   - Opening via localhost       → http://localhost:8000/api
//   - Opening via 10.3.12.29      → http://10.3.12.29:8000/api
//   - Opening via any other LAN IP → http://<that-ip>:8000/api
// An explicit VITE_API_BASE_URL in .env still takes priority if set.
function resolveApiBaseUrl(): string {
  const explicit = viteEnv.VITE_API_BASE_URL || procEnv.VITE_API_BASE_URL || procEnv.API_BASE_URL;
  if (explicit) return explicit;
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

// Prefix relative media URLs (e.g. /media/profile_images/...) with the backend origin.
// The backend returns relative URLs, but the frontend may be on a different port/origin.
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Simple fallback storage for non‑browser environments (e.g., ts-node)
const LS = typeof localStorage !== 'undefined' ? localStorage : {
  getItem: (key: string) => null as any,
  setItem: (key: string, value: string) => {},
  removeItem: (key: string) => {},
};

export type DjangoUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  department: string | null;
  phone: string | null;
  status: string;
  profile_image: string | null;
  email_notifications: boolean;
  dark_mode: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

export interface LoginResponse {
  access: string;
  refresh: string;
  user: DjangoUser;
}

export interface DjangoResponse<T> {
  success: boolean;
  message: string;
  data: T;
  status_code: number;
  errors?: any;
}

// ── Session helpers ────────────────────────────────────────────────────────

// "Remember me" controls whether access/refresh tokens persist across browser
// restarts. When enabled tokens live in localStorage; otherwise they live in
// sessionStorage and vanish when the tab closes. User metadata (profile cache)
// always stays in localStorage so the UI can render instantly before the
// session is validated against the backend.
const REMEMBER_KEY = 'django_remember';
const TOKEN_KEYS = ['django_access_token', 'django_refresh_token'];

function readToken(key: string): string | null {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(key);
    if (v) return v;
  }
  if (typeof sessionStorage !== 'undefined') {
    const v = sessionStorage.getItem(key);
    if (v) return v;
  }
  return null;
}

function writeToken(key: string, value: string) {
  const remember =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(REMEMBER_KEY) === 'true';
  if (remember) {
    localStorage.setItem(key, value);
  } else if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, value);
  }
}

function removeTokens() {
  for (const key of TOKEN_KEYS) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  }
}

/** Drop cached user identity when the JWT session is missing or invalid. */
export function clearStoredSession() {
  removeTokens();
  try {
    localStorage.removeItem('django_user');
    localStorage.removeItem('current_user_id');
    localStorage.removeItem('auth_user');
  } catch {}
}

/**
 * Dispatches a custom event so any listener (e.g. the router) can redirect
 * to the login page when the session has expired.
 */
function notifySessionExpired() {
  clearStoredSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sams:session-expired'));
  }
}

// ── Token refresh ─────────────────────────────────────────────────────────
let _isRefreshing = false;
let _refreshQueue: Array<(token: string | null) => void> = [];
let _refreshEndpointUnavailable = false;

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshEndpointUnavailable) return null;

  if (_isRefreshing) {
    return new Promise(resolve => { _refreshQueue.push(resolve); });
  }

  _isRefreshing = true;
  try {
    const refreshToken = readToken('django_refresh_token');
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.status === 404) {
      _refreshEndpointUnavailable = true;
      return null;
    }

    if (!response.ok) return null;

    const data = await response.json();
    const newAccess = data?.access;
    if (!newAccess) return null;

    writeToken('django_access_token', newAccess);
    _refreshQueue.forEach(cb => cb(newAccess));
    return newAccess;
  } catch {
    return null;
  } finally {
    _isRefreshing = false;
    _refreshQueue = [];
  }
}

// ── Core request helper ────────────────────────────────────────────────────
export async function djangoRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false,
): Promise<DjangoResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const token = readToken('django_access_token');
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    // 401: attempt token refresh once, then give up
    if (response.status === 401) {
      if (!_isRetry) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          return djangoRequest<T>(endpoint, options, true);
        }
      }
      notifySessionExpired();
      return { success: false, message: 'Session expired. Please log in again.', data: null as any, status_code: 401 };
    }

    // Non-OK responses that aren't JSON (e.g. 404 HTML pages) — return a clean failure
    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errData = await response.json();
        message = errData?.message || errData?.detail || message;
        // If the response is a standard DjangoResponse wrapper, return it directly
        if (typeof errData?.success === 'boolean') return errData;
      } catch {}
      return { success: false, message, data: null as any, status_code: response.status };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`API request failed: ${error}`);
  }
}

export async function loginWithDjango(email: string, password: string): Promise<DjangoUser | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data?.success || !data?.data) {
      return null;
    }

    const loginData = data.data as LoginResponse;
    writeToken('django_access_token', loginData.access);
    writeToken('django_refresh_token', loginData.refresh);
    LS.setItem('django_user', JSON.stringify(loginData.user));
    LS.setItem('current_user_id', String(loginData.user.id));
    const normalizedRole =
      String(loginData.user.role || '').toUpperCase().replace(/[\s-]+/g, '_') === 'SUPER_ADMIN'
        ? 'ADMIN'
        : loginData.user.role;
    LS.setItem('auth_user', JSON.stringify({
      id: String(loginData.user.id),
      name: loginData.user.name,
      email: loginData.user.email,
      role: normalizedRole,
      department: loginData.user.department,
      avatar_url: resolveMediaUrl(loginData.user.profile_image),
    }));
    
    return loginData.user;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<DjangoUser | null> {
  try {
    const response = await djangoRequest<DjangoUser>('/auth/me/');
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  } catch {
    return null;
  }
}

export async function logoutFromDjango(): Promise<void> {
  try {
    const refreshToken = readToken('django_refresh_token');
    await djangoRequest('/auth/logout/', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // best effort
  } finally {
    clearStoredSession();
  }
}

export function getStoredUser(): DjangoUser | null {
  try {
    const userStr = LS.getItem('django_user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(readToken('django_access_token'));
}
