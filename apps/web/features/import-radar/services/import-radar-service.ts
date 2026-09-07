import { env } from '@/lib/env';
import { authenticatedFetch } from '@/services/authenticated-fetch';
import {
  ImportCalculation,
  ImportProduct,
  ImportRadarFilters,
  ImportSearchResponse,
  UsaSourceProduct,
} from '../types/import-radar';

type CalculateImportCostPayload = Omit<ImportProduct, 'provider' | 'priceBrl' | 'dollarQuote'>;

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
    sourceManufacturer: product.sourceManufacturer,
    sourceManufacturerProvenance: product.sourceManufacturerProvenance,
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
    condition: product.condition,
  };
}

export async function confirmImportManufacturer(
  product: ImportProduct,
  confirmation: { canonicalName: string; alias?: string },
): Promise<ImportCalculation> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/confirm-manufacturer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...toCalculateImportCostPayload(product), confirmation }),
  });
  return parseResponse<ImportCalculation>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : 'Não foi possível concluir a operação.';
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
  const response = await authenticatedFetch(
    `${env.apiUrl}/import-radar/search${query ? `?${query}` : ''}`,
  );
  return parseResponse<ImportSearchResponse>(response);
}

export async function searchUsaSourceProducts(query: string): Promise<UsaSourceProduct[]> {
  const params = new URLSearchParams({ search: query });
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/usa/search?${params}`);
  return parseResponse<UsaSourceProduct[]>(response);
}

export interface UsaDiscoveryResponse {
  products: UsaSourceProduct[];
  providers: {
    provider: string;
    status: 'OK' | 'EMPTY' | 'UNAVAILABLE' | 'RATE_LIMITED';
    returnedCount: number;
  }[];
}

export async function searchUsaWithDiagnostics(query: string): Promise<UsaDiscoveryResponse> {
  const params = new URLSearchParams({ search: query });
  const response = await authenticatedFetch(
    `${env.apiUrl}/import-radar/usa/search/diagnostics?${params}`,
  );
  const result = await parseResponse<UsaDiscoveryResponse>(response);
  if (
    !Array.isArray(result?.products) ||
    !Array.isArray(result?.providers) ||
    result.providers.some(
      (report) =>
        !report || !['OK', 'EMPTY', 'UNAVAILABLE', 'RATE_LIMITED'].includes(report.status),
    )
  ) {
    throw new Error('Resposta de busca USA inválida.');
  }
  return result;
}

export type UsaEnrichmentDecision =
  | { status: 'READY'; reason: null }
  | {
      status: 'NEEDS_INPUT';
      reason: 'MANUFACTURER_MISSING';
      input: { type: 'MANUFACTURER'; field: 'manufacturer'; suggestedValue: string };
    }
  | { status: 'BLOCKED'; reason: string; fields?: string[] };

export interface UsaEnrichmentResponse {
  decision: UsaEnrichmentDecision;
  context: unknown;
}

export async function resolveUsaEnrichment(
  sourceProduct: UsaSourceProduct,
): Promise<UsaEnrichmentResponse> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/usa-enrichment/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceProduct }),
  });
  return parseResponse<UsaEnrichmentResponse>(response);
}

export async function confirmUsaManufacturer(
  sourceProduct: UsaSourceProduct,
  canonicalName: string,
): Promise<UsaEnrichmentResponse> {
  const response = await authenticatedFetch(
    `${env.apiUrl}/import-radar/usa-enrichment/confirm-manufacturer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceProduct, canonicalName }),
    },
  );
  const payload = await parseResponse<UsaEnrichmentResponse & { reprocessed: true }>(response);
  return payload;
}

export type UsaRedirectorSelection =
  { redirector: 'RED_DELAWARE'; shippingMode: 'EXPRESS' } | { redirector: 'REI_DO_IMPORTADO' };

export type UsaCostPreflightResponse =
  | { status: 'READY_FOR_COST'; shippingWeightLbs: number | null }
  | {
      status: 'NEEDS_INPUT';
      reason: 'MANUFACTURER_MISSING' | 'MISSING_WEIGHT';
      input: { type: 'MANUFACTURER' | 'WEIGHT'; suggestedValue?: string };
    }
  | { status: 'BLOCKED'; reason: string };

export async function preflightUsaCost(
  sourceProduct: UsaSourceProduct,
  redirector: UsaRedirectorSelection,
): Promise<UsaCostPreflightResponse> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/usa-cost-preflight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceProduct, redirector, composition: { kind: 'SINGLE_ITEM' } }),
  });
  return parseResponse<UsaCostPreflightResponse>(response);
}

export interface UsaPricedOfferResponse {
  status: 'READY' | 'NEEDS_INPUT' | 'BLOCKED';
  reason: string | null;
  costExecution: {
    preflight: { status: string; reason?: string };
    calculation: {
      finalCost: { currency: 'BRL'; amountBrl: number };
    } | null;
  };
  pricing: {
    acquisitionCost: number;
    financialClassification: 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';
    calculationStatus: string;
    salePrice: number | null;
    offerPrice: number | null;
    financialIdentity: {
      category: string | null;
      model: string | null;
      capacity: string | null;
      color: string | null;
      condition: 'NOVO' | 'SEMINOVO' | 'CPO' | null;
    };
    profit: {
      condition: 'NOVO' | 'SEMINOVO' | 'CPO' | null;
      productDescription: string;
    };
  } | null;
  offerDraft: unknown | null;
  offer: { id: string } | null;
}

export async function executeUsaPricedOffer(
  sourceProduct: UsaSourceProduct,
  redirector: UsaRedirectorSelection,
  composition: UsaShippingWeightComposition,
): Promise<UsaPricedOfferResponse> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/usa-priced-offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceProduct, redirector, composition }),
  });
  return parseResponse<UsaPricedOfferResponse>(response);
}

export type UsaShippingWeightComposition = { kind: 'SINGLE_ITEM' };

export type UsaShippingWeightResolution =
  | { status: 'WEIGHT_FOUND'; shippingWeightLbs: number }
  | { status: 'MISSING_WEIGHT' }
  | { status: 'KEY_INSUFFICIENT'; missingAttributes: string[] }
  | { status: 'KEY_AMBIGUOUS'; ambiguousSources: string[] };

type UsaShippingWeightSourceProduct = {
  sourceProductId: string;
  sourceName: string;
  supplier: string;
  sourceUrl: string;
  origin: 'US';
  sourceManufacturer?: string;
  sourceManufacturerProvenance?: 'EXPLICIT_SOURCE';
  category?: string;
  model?: string;
  capacity?: string;
  color?: string;
  condition?: 'NOVO' | 'SEMINOVO' | 'CPO';
};

function toUsaShippingWeightSourceProduct(
  sourceProduct: UsaSourceProduct,
): UsaShippingWeightSourceProduct {
  return {
    sourceProductId: sourceProduct.sourceProductId,
    sourceName: sourceProduct.sourceName,
    supplier: sourceProduct.supplier,
    sourceUrl: sourceProduct.sourceUrl,
    origin: sourceProduct.source,
    ...(sourceProduct.sourceManufacturer
      ? { sourceManufacturer: sourceProduct.sourceManufacturer }
      : {}),
    ...(sourceProduct.sourceManufacturerProvenance
      ? { sourceManufacturerProvenance: sourceProduct.sourceManufacturerProvenance }
      : {}),
    ...(sourceProduct.category ? { category: sourceProduct.category } : {}),
    ...(sourceProduct.model ? { model: sourceProduct.model } : {}),
    ...(sourceProduct.capacity ? { capacity: sourceProduct.capacity } : {}),
    ...(sourceProduct.color ? { color: sourceProduct.color } : {}),
    ...(sourceProduct.condition ? { condition: sourceProduct.condition } : {}),
  };
}

export async function resolveUsaShippingWeight(
  sourceProduct: UsaSourceProduct,
  composition: UsaShippingWeightComposition,
): Promise<UsaShippingWeightResolution> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/shipping-weights/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceProduct: toUsaShippingWeightSourceProduct(sourceProduct),
      composition,
    }),
  });
  return parseUsaShippingWeightResolution(await parseResponse<unknown>(response));
}

export async function registerUsaShippingWeight(
  sourceProduct: UsaSourceProduct,
  composition: UsaShippingWeightComposition,
  shippingWeightLbs: number,
): Promise<UsaShippingWeightRegistration> {
  const response = await authenticatedFetch(`${env.apiUrl}/import-radar/shipping-weights`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceProduct: toUsaShippingWeightSourceProduct(sourceProduct),
      composition,
      shippingWeightLbs,
    }),
  });
  const payload = await parseResponse<unknown>(response);
  const resolution = parseUsaShippingWeightResolution(payload);
  if (
    resolution.status !== 'WEIGHT_FOUND' ||
    !isRecord(payload) ||
    (payload.registration !== 'CREATED' && payload.registration !== 'IDEMPOTENT')
  ) {
    throw new Error('Resposta inválida ao salvar o peso operacional de envio.');
  }
  return {
    status: 'WEIGHT_FOUND',
    shippingWeightLbs: resolution.shippingWeightLbs,
    registration: payload.registration,
  };
}

function parseUsaShippingWeightResolution(payload: unknown): UsaShippingWeightResolution {
  if (!isRecord(payload) || typeof payload.status !== 'string') {
    throw new Error('Resposta inválida ao resolver o peso operacional de envio.');
  }

  switch (payload.status) {
    case 'WEIGHT_FOUND':
      if (
        typeof payload.shippingWeightLbs !== 'number' ||
        !Number.isFinite(payload.shippingWeightLbs)
      ) {
        throw new Error('Resposta inválida ao resolver o peso operacional de envio.');
      }
      return { status: 'WEIGHT_FOUND', shippingWeightLbs: payload.shippingWeightLbs };
    case 'MISSING_WEIGHT':
      return { status: 'MISSING_WEIGHT' };
    case 'KEY_INSUFFICIENT':
      if (!isStringArray(payload.missingAttributes)) {
        throw new Error('Resposta inválida ao resolver o peso operacional de envio.');
      }
      return { status: 'KEY_INSUFFICIENT', missingAttributes: payload.missingAttributes };
    case 'KEY_AMBIGUOUS':
      if (!isStringArray(payload.ambiguousSources)) {
        throw new Error('Resposta inválida ao resolver o peso operacional de envio.');
      }
      return { status: 'KEY_AMBIGUOUS', ambiguousSources: payload.ambiguousSources };
    default:
      throw new Error('Resposta inválida ao resolver o peso operacional de envio.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

type UsaShippingWeightRegistration = {
  status: 'WEIGHT_FOUND';
  shippingWeightLbs: number;
  registration: 'CREATED' | 'IDEMPOTENT';
};

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
