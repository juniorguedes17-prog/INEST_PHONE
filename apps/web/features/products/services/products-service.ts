import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import {
  ProductFilters,
  ProductFormPayload,
  ProductItem,
  ProductReferences,
} from '../types/products';

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

function buildQuery(filters: ProductFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function listProducts(filters: ProductFilters): Promise<ProductItem[]> {
  const query = buildQuery(filters);
  const response = await authenticatedFetch(`${env.apiUrl}/products${query ? `?${query}` : ''}`);
  return parseResponse<ProductItem[]>(response);
}

export async function getProductReferences(): Promise<ProductReferences> {
  const response = await authenticatedFetch(`${env.apiUrl}/products/references`);
  return parseResponse<ProductReferences>(response);
}

export async function createProduct(payload: ProductFormPayload): Promise<ProductItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<ProductItem>(response);
}

export async function updateProduct(id: string, payload: ProductFormPayload): Promise<ProductItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<ProductItem>(response);
}

export async function deleteProduct(id: string): Promise<ProductItem> {
  const response = await authenticatedFetch(`${env.apiUrl}/products/${id}`, {
    method: 'DELETE',
  });
  return parseResponse<ProductItem>(response);
}
