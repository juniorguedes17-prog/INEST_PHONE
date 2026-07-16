import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import { SupplierFilters, SupplierFormPayload, SupplierItem } from '../types/suppliers';

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

function buildQuery(filters: SupplierFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function listSuppliers(filters: SupplierFilters): Promise<SupplierItem[]> {
  const query = buildQuery(filters);
  const response = await authenticatedFetch(`${env.apiUrl}/suppliers${query ? `?${query}` : ''}`);
  return parseResponse<SupplierItem[]>(response);
}

export async function getSupplier(id: string): Promise<SupplierItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/suppliers/${id}`);
  return parseResponse<SupplierItem>(response);
}

export async function createSupplier(payload: SupplierFormPayload): Promise<SupplierItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/suppliers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<SupplierItem>(response);
}

export async function updateSupplier(
  id: string,
  payload: SupplierFormPayload,
): Promise<SupplierItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/suppliers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<SupplierItem>(response);
}

export async function deleteSupplier(id: string): Promise<SupplierItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/suppliers/${id}`, {
    method: 'DELETE',
  });
  return parseResponse<SupplierItem>(response);
}
