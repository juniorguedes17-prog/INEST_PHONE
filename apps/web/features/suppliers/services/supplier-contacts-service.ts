import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import {
  SupplierContactFormPayload,
  SupplierContactItem,
} from '../types/suppliers';

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

export async function listSupplierContacts(filters: {
  search: string;
  isActive?: boolean;
}): Promise<SupplierContactItem[]> {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set('search', filters.search);
  }
  if (typeof filters.isActive === 'boolean') {
    params.set('isActive', String(filters.isActive));
  }

  const query = params.toString();
  const response = await authenticatedFetch(
    `${env.apiUrl}/supplier-contacts${query ? `?${query}` : ''}`,
  );
  return parseResponse<SupplierContactItem[]>(response);
}

export async function createSupplierContact(
  payload: SupplierContactFormPayload,
): Promise<SupplierContactItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/supplier-contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<SupplierContactItem>(response);
}

export async function updateSupplierContact(
  id: string,
  payload: SupplierContactFormPayload,
): Promise<SupplierContactItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/supplier-contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<SupplierContactItem>(response);
}

export async function setSupplierContactActive(
  id: string,
  isActive: boolean,
): Promise<SupplierContactItem> {
  const response = await authenticatedFetch(
    `${env.apiUrl}/supplier-contacts/${id}/${isActive ? 'activate' : 'deactivate'}`,
    { method: 'PATCH' },
  );
  return parseResponse<SupplierContactItem>(response);
}
