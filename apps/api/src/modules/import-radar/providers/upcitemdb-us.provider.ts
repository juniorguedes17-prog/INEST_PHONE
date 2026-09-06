import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';
import { adaptUsaSourceProduct, type UsaSourceProduct } from '../usa-source-product.adapter';

const UPCITEMDB_US_SEARCH_URL = 'https://api.upcitemdb.com/prod/trial/search';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;
const OFFER_FRESHNESS_MS = 24 * 60 * 60_000;

type SupportedRetailer = 'Best Buy' | 'B&H Photo Video' | 'Adorama' | 'Walmart';

interface UpcItemDbItem {
  ean?: unknown;
  upc?: unknown;
  gtin?: unknown;
  title?: unknown;
  brand?: unknown;
  model?: unknown;
  color?: unknown;
  category?: unknown;
  images?: unknown;
  offers?: unknown;
}

interface UpcItemDbOffer {
  merchant?: unknown;
  domain?: unknown;
  title?: unknown;
  currency?: unknown;
  price?: unknown;
  condition?: unknown;
  availability?: unknown;
  link?: unknown;
  updated_t?: unknown;
}

interface ParsedOfferCandidate {
  product: ImportProviderProduct;
  updatedAtMs: number;
}

interface CacheEntry {
  expiresAt: number;
  candidates: ParsedOfferCandidate[];
}

interface ProviderResponse {
  items?: unknown;
  code?: unknown;
  message?: unknown;
}

/**
 * UPCitemdb's free trial API is an aggregator, not a trusted retailer. The
 * provider preserves the merchant as source context and only maps a retailer
 * when the merchant/domain pair matches an explicit safe alias. Walmart is
 * intentionally left without retailer authority because the API offer does
 * not prove that Walmart is the seller.
 */
@Injectable()
export class UpcItemDbUsProvider implements ImportProvider {
  readonly name = 'upcitemdb_us';
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    const search = normalizeText(query.search ?? '');
    if (!search) return [];

    const now = Date.now();
    const cacheKey = `${search}|${normalizeText(query.category ?? '')}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return freshProducts(cached.candidates, now);
    }

    try {
      const payload = await this.fetchSearch(search, query.category);
      const candidates = parseUpcItemDbOffers(payload, now);
      this.cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, candidates });
      return freshProducts(candidates, now);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        `UPCitemdb USA indisponivel no momento: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Explicit P6A handoff; no cost, TAX, weight, or pricing decision occurs. */
  async searchUsaSourceProducts(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]> {
    return (await this.search(query)).map((product) =>
      adaptUsaSourceProduct({ providerName: this.name, product }),
    );
  }

  private async fetchSearch(search: string, category?: string): Promise<ProviderResponse> {
    const url = new URL(UPCITEMDB_US_SEARCH_URL);
    url.searchParams.set('s', search);
    if (category?.trim()) url.searchParams.set('category', category.trim());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'User-Agent': 'iNestPhone-PriceRadar/1.0 (+public-price-consultation)',
        },
      });

      if (response.status === 404) return { items: [] };
      if (response.status === 429) {
        throw new ServiceUnavailableException('UPCitemdb USA rate limit atingido.');
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error('UPCitemdb response is not a JSON object');
      if (payload.code && payload.code !== 'OK') {
        if (payload.code === 'NOT_FOUND') return { items: [] };
        throw new Error(`UPCitemdb ${String(payload.code)}: ${String(payload.message ?? '')}`);
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Parses only the documented UPCitemdb response shape. It is exported so the
 * unit suite can exercise source data without spending the free API quota.
 */
export function parseUpcItemDbOffers(payload: unknown, nowMs = Date.now()): ParsedOfferCandidate[] {
  if (!isRecord(payload)) throw new Error('UPCitemdb response is malformed');
  if (payload.code && payload.code !== 'OK') {
    if (payload.code === 'NOT_FOUND') return [];
    throw new Error(`UPCitemdb response error: ${String(payload.code)}`);
  }

  if (!Array.isArray(payload.items)) throw new Error('UPCitemdb response items are malformed');

  const candidates: ParsedOfferCandidate[] = [];
  for (const rawItem of payload.items) {
    if (!isRecord(rawItem)) continue;
    const item = rawItem as UpcItemDbItem;
    const itemIdentity = stableItemIdentity(item);
    const itemName = text(item.title);
    const itemBrand = text(item.brand);
    const itemModel = text(item.model);
    const itemColor = text(item.color);
    const itemCategory = text(item.category) ?? '';
    const imageUrl = firstHttpUrl(item.images);
    if (!itemIdentity || !Array.isArray(item.offers)) continue;

    for (const rawOffer of item.offers) {
      if (!isRecord(rawOffer)) continue;
      const candidate = parseOffer(rawOffer as UpcItemDbOffer, {
        item,
        itemIdentity,
        itemName,
        itemBrand,
        itemModel,
        itemColor,
        itemCategory,
        imageUrl,
        nowMs,
      });
      if (candidate) candidates.push(candidate);
    }
  }

  return deduplicateCandidates(candidates);
}

function parseOffer(
  offer: UpcItemDbOffer,
  context: {
    item: UpcItemDbItem;
    itemIdentity: string;
    itemName: string | null;
    itemBrand: string | null;
    itemModel: string | null;
    itemColor: string | null;
    itemCategory: string;
    imageUrl: string | undefined;
    nowMs: number;
  },
): ParsedOfferCandidate | null {
  const merchant = text(offer.merchant);
  const domain = normalizeDomain(offer.domain);
  const productUrl = httpUrl(offer.link);
  const sourceName = context.itemName ?? text(offer.title);
  const priceUsd = numberValue(offer.price);
  const updatedAtMs = timestampMs(offer.updated_t);

  if (
    !merchant ||
    !domain ||
    !productUrl ||
    !sourceName ||
    priceUsd === null ||
    updatedAtMs === null ||
    updatedAtMs > context.nowMs ||
    context.nowMs - updatedAtMs > OFFER_FRESHNESS_MS ||
    !isAvailable(offer.availability) ||
    !isUsd(offer.currency)
  ) {
    return null;
  }

  const sourceProductId = buildSourceProductId(context.itemIdentity, merchant, domain, productUrl);
  if (!sourceProductId) return null;

  const retailer = mapRetailer(merchant, domain);
  const product: ImportProviderProduct = {
    id: sourceProductId,
    externalId: context.itemIdentity,
    name: sourceName,
    store: merchant,
    retailer,
    category: context.itemCategory,
    priceUsd,
    productUrl,
    ...(context.imageUrl ? { imageUrl: context.imageUrl } : {}),
    ...(context.itemBrand
      ? {
          sourceManufacturer: context.itemBrand,
          sourceManufacturerProvenance: 'EXPLICIT_SOURCE' as const,
        }
      : {}),
    ...(context.itemModel ? { model: context.itemModel } : {}),
    ...(context.itemColor ? { color: context.itemColor } : {}),
    ...(parseCondition(offer.condition) ? { condition: parseCondition(offer.condition) } : {}),
    origin: 'US',
    consultedAt: new Date(context.nowMs).toISOString(),
  };

  return { product, updatedAtMs };
}

function stableItemIdentity(item: UpcItemDbItem): string | null {
  for (const value of [item.ean, item.upc, item.gtin]) {
    const normalized = text(value)?.replace(/[^0-9A-Za-z-]/g, '');
    if (normalized) return normalized;
  }
  return null;
}

function buildSourceProductId(
  itemIdentity: string,
  merchant: string,
  domain: string,
  productUrl: string,
): string {
  const url = new URL(productUrl);
  return `upcitemdb-us:${itemIdentity}:${slug(merchant)}:${domain}:${url.pathname}${url.search}`;
}

function mapRetailer(merchant: string, domain: string): SupportedRetailer | null {
  const merchantKey = normalizeRetailer(merchant);
  const domainKey = normalizeDomainKey(domain);

  if (merchantKey === 'walmart' && domainKey === 'walmart.com') return null;
  if (merchantKey === 'best buy' && domainKey === 'bestbuy.com') return 'Best Buy';
  if (
    (merchantKey === 'b h photo video' || merchantKey === 'b h photo') &&
    domainKey === 'bhphotovideo.com'
  ) {
    return 'B&H Photo Video';
  }
  if (merchantKey === 'adorama' && domainKey === 'adorama.com') return 'Adorama';
  return null;
}

function parseCondition(value: unknown): ImportProviderProduct['condition'] | undefined {
  const condition = normalizeRetailer(text(value) ?? '');
  if (condition === 'new') return 'NOVO';
  if (condition === 'used') return 'SEMINOVO';
  return undefined;
}

function isAvailable(value: unknown): boolean {
  const availability = normalizeRetailer(text(value) ?? '');
  return availability === '' || availability !== 'out of stock';
}

function isUsd(value: unknown): boolean {
  const currency = text(value)?.toUpperCase() ?? '';
  // The official API documents an empty currency as USD.
  return currency === '' || currency === 'USD';
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function timestampMs(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function freshProducts(candidates: readonly ParsedOfferCandidate[], nowMs: number) {
  return candidates
    .filter(
      (candidate) =>
        nowMs >= candidate.updatedAtMs && nowMs - candidate.updatedAtMs <= OFFER_FRESHNESS_MS,
    )
    .map((candidate) => candidate.product);
}

function deduplicateCandidates(candidates: ParsedOfferCandidate[]) {
  const unique = new Map<string, ParsedOfferCandidate>();
  const conflicts = new Set<string>();

  for (const candidate of candidates) {
    const previous = unique.get(candidate.product.id);
    if (!previous) {
      if (!conflicts.has(candidate.product.id)) unique.set(candidate.product.id, candidate);
      continue;
    }
    if (
      previous.product.priceUsd !== candidate.product.priceUsd ||
      previous.product.store !== candidate.product.store ||
      previous.product.retailer !== candidate.product.retailer
    ) {
      unique.delete(candidate.product.id);
      conflicts.add(candidate.product.id);
    }
  }

  return [...unique.values()];
}

function firstHttpUrl(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const entry of value) {
    const url = httpUrl(entry);
    if (url) return url;
  }
  return undefined;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeDomain(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const candidate = raw.includes('://') ? raw : `https://${raw}`;
  try {
    const hostname = new URL(candidate).hostname.toLocaleLowerCase('en-US').replace(/^www\./, '');
    return hostname.includes('.') ? hostname : null;
  } catch {
    return null;
  }
}

function normalizeDomainKey(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/^www\./, '');
}

function normalizeRetailer(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
