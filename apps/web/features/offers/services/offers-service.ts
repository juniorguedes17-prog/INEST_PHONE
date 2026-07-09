import { env } from '@/lib/env';
import { PricingItem } from '@/features/pricing/types/pricing';
import { listPricing } from '@/features/pricing/services/pricing-service';
import { CommercialTemplate, GenerateOfferPayload, OfferItem } from '../types/offers';

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

export async function listOfferProducts(): Promise<PricingItem[]> {
  return listPricing({
    search: '',
    category: '',
    model: '',
    color: '',
    capacity: '',
    productType: '',
    status: '',
    minPrice: '',
    maxPrice: '',
    sort: 'lowest_price',
  });
}

export async function listTemplates(): Promise<CommercialTemplate[]> {
  const response = await fetch(`${env.apiUrl}/offers/templates`, {
    credentials: 'include',
  });
  return parseResponse<CommercialTemplate[]>(response);
}

export async function listOffers(): Promise<OfferItem[]> {
  const response = await fetch(`${env.apiUrl}/offers`, {
    credentials: 'include',
  });
  return parseResponse<OfferItem[]>(response);
}

export async function generateOffer(payload: GenerateOfferPayload): Promise<OfferItem> {
  const response = await fetch(`${env.apiUrl}/offers/generate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<OfferItem>(response);
}

export async function duplicateOffer(id: string): Promise<OfferItem> {
  const response = await fetch(`${env.apiUrl}/offers/${id}/duplicate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Duplicado pela interface' }),
  });
  return parseResponse<OfferItem>(response);
}

export async function deleteOffer(id: string): Promise<OfferItem> {
  const response = await fetch(`${env.apiUrl}/offers/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return parseResponse<OfferItem>(response);
}

export async function registerOfferCopy(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${env.apiUrl}/offers/${id}/copy`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseResponse<{ success: boolean }>(response);
}

export async function shareOffer(id: string): Promise<{ whatsappUrl: string }> {
  const response = await fetch(`${env.apiUrl}/offers/${id}/share`, {
    method: 'POST',
    credentials: 'include',
  });
  return parseResponse<{ whatsappUrl: string }>(response);
}
