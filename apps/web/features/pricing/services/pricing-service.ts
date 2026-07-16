import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import {
  OfferDraft,
  PricingFilters,
  PricingItem,
  TemporaryImportPricing,
  TemporaryImportPricingRequest,
} from '../types/pricing';

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

function buildQuery(filters: PricingFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function listPricing(filters: PricingFilters): Promise<PricingItem[]> {
  const query = buildQuery(filters);
  const response = await authenticatedFetch(`${env.apiUrl}/pricing${query ? `?${query}` : ''}`);
  return parseResponse<PricingItem[]>(response);
}

export async function recalculatePricing(filters: PricingFilters): Promise<PricingItem[]> {
  const response = await authenticatedFetch(`${env.apiUrl}/pricing/recalculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters),
  });
  return parseResponse<PricingItem[]>(response);
}

export async function generateOfferDraft(productId: string): Promise<OfferDraft> {
  const response = await authenticatedFetch(`${env.apiUrl}/pricing/generate-offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  return parseResponse<OfferDraft>(response);
}

export async function calculateTemporaryImportPricing(
  payload: TemporaryImportPricingRequest,
): Promise<TemporaryImportPricing> {
  const response = await authenticatedFetch(`${env.apiUrl}/pricing/temporary-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<TemporaryImportPricing>(response);
}
