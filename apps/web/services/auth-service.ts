import { env } from '@/lib/env';
import { LoginResponse } from '@/types/auth';

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

  return parseResponse<LoginResponse>(response);
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

  return parseResponse<LoginResponse>(response);
}
