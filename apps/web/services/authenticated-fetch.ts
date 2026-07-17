import { env } from '@/lib/env';

const ACCESS_TOKEN_STORAGE_KEY = 'inest.access-token';

interface RefreshResponse {
  tokens?: {
    accessToken?: unknown;
  };
}

let refreshInFlight: Promise<string | null> | null = null;

export function persistAccessToken(accessToken: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  }
}

export function clearAccessToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function isAuthEndpoint(input: RequestInfo | URL): boolean {
  const requestUrl = input instanceof Request ? input.url : String(input);
  return requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh');
}

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = fetch(`${env.apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({}),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearAccessToken();
          return null;
        }

        const payload = (await response.json().catch(() => null)) as RefreshResponse | null;
        const accessToken = payload?.tokens?.accessToken;

        if (typeof accessToken !== 'string' || !accessToken) {
          clearAccessToken();
          return null;
        }

        persistAccessToken(accessToken);
        return accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  const accessToken = getStoredAccessToken();

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status !== 401 || isAuthEndpoint(input)) {
    return response;
  }

  const refreshedAccessToken = await refreshAccessToken();

  if (!refreshedAccessToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);

  return fetch(input, {
    ...init,
    headers: retryHeaders,
    credentials: 'include',
  });
}
