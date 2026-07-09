import { env } from '@/lib/env';
import { DashboardData, DashboardFilters } from '../types/dashboard';

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Nao foi possivel carregar o Dashboard.';
    throw new Error(message);
  }

  return payload as T;
}

function buildQuery(filters: DashboardFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function getDashboard(filters: DashboardFilters): Promise<DashboardData> {
  const query = buildQuery(filters);
  const response = await fetch(`${env.apiUrl}/dashboard${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });
  return parseResponse<DashboardData>(response);
}
