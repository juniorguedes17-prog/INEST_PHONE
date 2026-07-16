import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import { ExportArtifact, IntegrationJob, IntegrationStatus } from '../types/integrations';

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

export async function getIntegrationStatus(): Promise<IntegrationStatus[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/status`);
  return parseResponse<IntegrationStatus[]>(response);
}

export async function testIntegration(provider: string) {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/${provider}/test`, {
    method: 'POST',
  });
  return parseResponse<{ success: boolean; message: string; durationMs?: number }>(response);
}

export async function syncIntegration(provider: string) {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/${provider}/sync`, {
    method: 'POST',
  });
  return parseResponse<{ success: boolean; message: string; durationMs?: number }>(response);
}

export async function exportIntegration(format: string, dataset: string): Promise<ExportArtifact> {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, dataset }),
  });
  return parseResponse<ExportArtifact>(response);
}

export async function importIntegration(source: string, content: string) {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, content }),
  });
  return parseResponse<{ success: boolean; message: string }>(response);
}

export async function getIntegrationJobs(): Promise<IntegrationJob[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/jobs`);
  return parseResponse<IntegrationJob[]>(response);
}

export async function getIntegrationHistory(): Promise<unknown[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/history`);
  return parseResponse<unknown[]>(response);
}

export async function clearIntegrationCache() {
  const response = await authenticatedFetch(`${env.apiUrl}/integrations/cache`, {
    method: 'DELETE',
  });
  return parseResponse<{ success: boolean; message: string }>(response);
}
