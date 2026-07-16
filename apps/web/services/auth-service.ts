import { env } from '@/lib/env';
import { LoginResponse } from '@/types/auth';
import { clearAccessToken, persistAccessToken } from './authenticated-fetch';

interface LoginInput {
  email: string;
  password: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      isObjectWithMessage(payload) && payload.message
        ? payload.message
        : 'Nao foi possivel concluir a operacao.';
    throw new Error(message);
  }

  return payload as T;
}

function isObjectWithMessage(payload: unknown): payload is { message?: string } {
  return typeof payload === 'object' && payload !== null && 'message' in payload;
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const response = await fetch(`${env.apiUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(input),
  });

  const result = await parseResponse<LoginResponse>(response);
  persistAccessToken(result.tokens.accessToken);
  return result;
}

export async function logout(): Promise<void> {
  await fetch(`${env.apiUrl}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  clearAccessToken();
}

export async function refreshSession(): Promise<LoginResponse> {
  const response = await fetch(`${env.apiUrl}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const result = await parseResponse<LoginResponse>(response);
  persistAccessToken(result.tokens.accessToken);
  return result;
}
