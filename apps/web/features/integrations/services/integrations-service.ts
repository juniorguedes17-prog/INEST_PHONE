import { env } from '@/lib/env';
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
  const response = await fetch(`${env.apiUrl}/integrations/status`, { credentials: 'include' });
  return parseResponse<IntegrationStatus[]>(response);
}

export async function testIntegration(provider: string) {
  const response = await fetch(`${env.apiUrl}/integrations/${provider}/test`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseResponse<{ success: boolean; message: string; durationMs?: number }>(response);
}

export async function syncIntegration(provider: string) {
  const response = await fetch(`${env.apiUrl}/integrations/${provider}/sync`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseResponse<{ success: boolean; message: string; durationMs?: number }>(response);
}

export async function exportIntegration(format: string, dataset: string): Promise<ExportArtifact> {
  const response = await fetch(`${env.apiUrl}/integrations/export`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, dataset }),
  });
  return parseResponse<ExportArtifact>(response);
}

export async function importIntegration(source: string, content: string) {
  const response = await fetch(`${env.apiUrl}/integrations/import`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, content }),
  });
  return parseResponse<{ success: boolean; message: string }>(response);
}

export async function getIntegrationJobs(): Promise<IntegrationJob[]> {
  const response = await fetch(`${env.apiUrl}/integrations/jobs`, { credentials: 'include' });
  return parseResponse<IntegrationJob[]>(response);
}

export async function getIntegrationHistory(): Promise<unknown[]> {
  const response = await fetch(`${env.apiUrl}/integrations/history`, { credentials: 'include' });
  return parseResponse<unknown[]>(response);
}

export async function clearIntegrationCache() {
  const response = await fetch(`${env.apiUrl}/integrations/cache`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseResponse<{ success: boolean; message: string }>(response);
}
