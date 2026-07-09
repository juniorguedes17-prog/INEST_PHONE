import { env } from '@/lib/env';
import {
  CsvImportResult,
  PriceQuoteFormPayload,
  PriceQuoteItem,
  PriceRadarFilters,
  PriceRadarKpis,
} from '../types/price-radar';

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

function buildQuery(filters: Partial<PriceRadarFilters>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  return params.toString();
}

export async function listPriceQuotes(filters: PriceRadarFilters): Promise<PriceQuoteItem[]> {
  const query = buildQuery(filters);
  const response = await fetch(`${env.apiUrl}/price-radar/quotes${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });
  return parseResponse<PriceQuoteItem[]>(response);
}

export async function getPriceRadarKpis(filters: PriceRadarFilters): Promise<PriceRadarKpis> {
  const query = buildQuery(filters);
  const response = await fetch(`${env.apiUrl}/price-radar/kpis${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });
  return parseResponse<PriceRadarKpis>(response);
}

export async function createPriceQuote(payload: PriceQuoteFormPayload): Promise<PriceQuoteItem> {
  const response = await fetch(`${env.apiUrl}/price-radar/quotes`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<PriceQuoteItem>(response);
}

export async function updatePriceQuote(
  id: string,
  payload: PriceQuoteFormPayload,
): Promise<PriceQuoteItem> {
  const response = await fetch(`${env.apiUrl}/price-radar/quotes/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse<PriceQuoteItem>(response);
}

export async function hidePriceQuote(id: string): Promise<PriceQuoteItem> {
  const response = await fetch(`${env.apiUrl}/price-radar/quotes/${id}/hide`, {
    method: 'PATCH',
    credentials: 'include',
  });
  return parseResponse<PriceQuoteItem>(response);
}

export async function importPriceRadarCsv(csvContent: string): Promise<CsvImportResult> {
  const response = await fetch(`${env.apiUrl}/price-radar/import/csv`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csvContent }),
  });
  return parseResponse<CsvImportResult>(response);
}
