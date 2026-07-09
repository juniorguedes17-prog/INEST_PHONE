import { env } from '@/lib/env';
import {
  ImportCalculation,
  ImportProduct,
  ImportRadarFilters,
  ImportSearchResponse,
} from '../types/import-radar';

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

function buildQuery(filters: ImportRadarFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function searchImportProducts(
  filters: ImportRadarFilters,
): Promise<ImportSearchResponse> {
  const query = buildQuery(filters);
  const response = await fetch(`${env.apiUrl}/import-radar/search${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });
  return parseResponse<ImportSearchResponse>(response);
}

export async function calculateImportCost(product: ImportProduct): Promise<ImportCalculation> {
  const response = await fetch(`${env.apiUrl}/import-radar/calculate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  return parseResponse<ImportCalculation>(response);
}

export async function listImportHistory(): Promise<unknown[]> {
  const response = await fetch(`${env.apiUrl}/import-radar/history`, {
    credentials: 'include',
  });
  return parseResponse<unknown[]>(response);
}
