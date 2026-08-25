'use client';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const VERCEL_WEB_PREVIEW_PREFIX = 'khebooth-git-';
const VERCEL_TEAM_PREVIEW_SUFFIX = '-paokurtis-1101s-projects.vercel.app';
const TOKEN_KEY = 'khe_booth_access_token';
const USER_KEY = 'khe_booth_user';

export type SessionUser = { id: string; email: string; role: string };

function resolveBranchPreviewApiUrl() {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname.toLowerCase();
  if (
    !hostname.startsWith(VERCEL_WEB_PREVIEW_PREFIX) ||
    !hostname.endsWith(VERCEL_TEAM_PREVIEW_SUFFIX)
  ) {
    return null;
  }

  const branchAndTeamHostname = hostname.slice(VERCEL_WEB_PREVIEW_PREFIX.length);
  return `https://khebooth-api-git-${branchAndTeamHostname}/api`;
}

function resolveApiUrl() {
  const branchPreviewApiUrl = resolveBranchPreviewApiUrl();
  if (branchPreviewApiUrl) return branchPreviewApiUrl;

  if (configuredApiUrl) return configuredApiUrl.replace(/\/$/, '');

  return process.env.NODE_ENV === 'production'
    ? 'https://khebooth-api.vercel.app/api'
    : 'http://localhost:3001/api';
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setSessionUser(user: SessionUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAccessToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${resolveApiUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    clearAccessToken();
    window.location.assign('/login');
  }

  if (!response.ok) {
    let message = `Erreur API (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string | string[] };
      if (Array.isArray(payload.message)) message = payload.message.join(', ');
      else if (payload.message) message = payload.message;
    } catch {
      // Keep the status-based fallback when the response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
