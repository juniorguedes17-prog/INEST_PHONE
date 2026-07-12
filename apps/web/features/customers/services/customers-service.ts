import { env } from '@/lib/env';
import { CustomersResponse } from '../types/customers';

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, credentials: 'include' });
  const payload = (await response.json().catch(() => null)) as CustomersResponse | { message?: string } | null;
  if (!response.ok) throw new Error(payload && 'message' in payload ? String(payload.message) : 'Falha ao consultar o Google Sheets.');
  return payload as CustomersResponse;
}
export function getCustomers(params: { search: string; origin: string; page: number; pageSize: number }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set('search', params.search);
  if (params.origin) query.set('origin', params.origin);
  return request(`${env.apiUrl}/customers?${query}`);
}
export function syncCustomers() { return request(`${env.apiUrl}/customers/sync`, { method: 'POST' }); }
