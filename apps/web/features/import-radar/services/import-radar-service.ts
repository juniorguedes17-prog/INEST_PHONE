import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import {
  ImportCalculation,
  ImportProduct,
  ImportRadarFilters,
  ImportSearchResponse,
} from '../types/import-radar';

type CalculateImportCostPayload = Omit<
  ImportProduct,
  'provider' | 'priceBrl' | 'dollarQuote'
>;

function toCalculateImportCostPayload(product: ImportProduct): CalculateImportCostPayload {
  return {
    id: product.id,
    name: product.name,
    store: product.store,
    category: product.category,
    priceUsd: product.priceUsd,
    productUrl: product.productUrl,
    imageUrl: product.imageUrl,
    brand: product.brand,
    model: product.model,
    capacity: product.capacity,
    color: product.color,
    city: product.city,
    priceBrlSource: product.priceBrlSource,
    availability: product.availability,
    storeUrl: product.storeUrl,
    consultedAt: product.consultedAt,
    origin: product.origin,
    externalId: product.externalId,
    minimumPriceUsd: product.minimumPriceUsd,
    averagePriceUsd: product.averagePriceUsd,
    maximumPriceUsd: product.maximumPriceUsd,
    storeCount: product.storeCount,
    offerCount: product.offerCount,
  };
}

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
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/search${query ? `?${query}` : ''}`);
  return parseResponse<ImportSearchResponse>(response);
}

export async function calculateImportCost(product: ImportProduct): Promise<ImportCalculation> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toCalculateImportCostPayload(product)),
  });
  return parseResponse<ImportCalculation>(response);
}

export async function listImportHistory(): Promise<unknown[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/history`);
  return parseResponse<unknown[]>(response);
}
