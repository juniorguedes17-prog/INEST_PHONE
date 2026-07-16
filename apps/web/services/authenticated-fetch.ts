const ACCESS_TOKEN_STORAGE_KEY = 'inest.access-token';

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

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (typeof window !== 'undefined') {
    const accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
}
