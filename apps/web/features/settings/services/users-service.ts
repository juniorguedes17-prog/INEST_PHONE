import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import { AccessUser, CreateAdministratorInput, UpdateAdministratorInput } from '../types/users';

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Nao foi possivel concluir a operacao.';
    throw new Error(message);
  }

  return payload as T;
}

export async function listAccessUsers(): Promise<AccessUser[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/users`);
  return parseResponse<AccessUser[]>(response);
}

export async function createAdministrator(input: CreateAdministratorInput): Promise<AccessUser> {
  const response = await authenticatedFetch(`${env.apiUrl}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseResponse<AccessUser>(response);
}

export async function updateAccessUser(
  id: string,
  input: UpdateAdministratorInput,
): Promise<AccessUser> {
  const response = await authenticatedFetch(`${env.apiUrl}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  return parseResponse<AccessUser>(response);
}

export async function deactivateAccessUser(id: string): Promise<AccessUser> {
  const response = await authenticatedFetch(`${env.apiUrl}/users/${id}/deactivate`, {
    method: 'PATCH',
  });

  return parseResponse<AccessUser>(response);
}

export async function activateAccessUser(id: string): Promise<AccessUser> {
  const response = await authenticatedFetch(`${env.apiUrl}/users/${id}/activate`, {
    method: 'PATCH',
  });

  return parseResponse<AccessUser>(response);
}
