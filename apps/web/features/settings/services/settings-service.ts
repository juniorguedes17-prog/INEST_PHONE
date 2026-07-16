import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import { SettingsPayload } from '../types/settings';

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Nao foi possivel salvar as configuracoes.';
    throw new Error(message);
  }

  return payload as T;
}

export async function getSettings(): Promise<SettingsPayload> {
  const response = await authenticatedFetch(`${env.apiUrl}/settings`);

  return parseResponse<SettingsPayload>(response);
}

export async function updateSettings(settings: SettingsPayload): Promise<SettingsPayload> {
  const response = await authenticatedFetch(`${env.apiUrl}/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  return parseResponse<SettingsPayload>(response);
}

export async function resetSettingsDefaults(): Promise<SettingsPayload> {
  const response = await authenticatedFetch(`${env.apiUrl}/settings/reset-defaults`, {
    method: 'POST',
  });

  return parseResponse<SettingsPayload>(response);
}
