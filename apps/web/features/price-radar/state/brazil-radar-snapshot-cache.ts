import {
  buildBrazilRadarFacetIndex,
  isVisibleRadarQuote,
  type BrazilRadarFacetState,
  type RadarFacetIndex,
} from '../utils/brazil-radar-facets';
import { AUTH_SESSION_CLEARED_EVENT } from '@/services/authenticated-fetch';
import { getPriceRadarKpis, listPriceQuotes } from '../services/price-radar-service';
import { PriceQuoteItem, PriceRadarFilters, PriceRadarKpis } from '../types/price-radar';

export const BRAZIL_RADAR_STALE_TIME_MS = 30_000;
export const BRAZIL_RADAR_REVALIDATE_INTERVAL_MS = 60_000;

export const initialPriceRadarFilters: PriceRadarFilters = {
  search: '',
  productId: '',
  supplierId: '',
  city: '',
  quality: '',
  deliveryTime: '',
  status: '',
  sort: 'lowest_price',
};

export const initialPriceRadarKpis: PriceRadarKpis = {
  lowestValidPrice: 0,
  averagePrice: 0,
  highestPrice: 0,
  hiddenCount: 0,
};

export interface BrazilRadarUiState {
  facetFilters: BrazilRadarFacetState | null;
  page: number;
  pageSize: number;
}

export interface BrazilRadarSnapshotCache {
  items: PriceQuoteItem[];
  visibleItems: PriceQuoteItem[];
  facetIndex: RadarFacetIndex;
  kpis: PriceRadarKpis;
  requestKey: string | null;
  fingerprint: string | null;
  lastUpdated: string | null;
  loadedAt: number | null;
  isRevalidating: boolean;
  error: string | null;
  filters: PriceRadarFilters;
  ui: BrazilRadarUiState;
}

interface PriceRadarSnapshotResponse {
  items: PriceQuoteItem[];
  kpis: PriceRadarKpis;
}

export type PriceRadarSnapshotFetcher = (
  filters: PriceRadarFilters,
) => Promise<PriceRadarSnapshotResponse>;

interface InFlightRequest {
  id: number;
  key: string;
  promise: Promise<BrazilRadarRevalidationResult>;
}

export interface BrazilRadarRevalidationResult {
  changed: boolean;
}

const listeners = new Set<() => void>();
let requestSequence = 0;
let inFlightRequest: InFlightRequest | null = null;
let cache = createInitialCache();

function createInitialCache(): BrazilRadarSnapshotCache {
  return {
    items: [],
    visibleItems: [],
    facetIndex: buildBrazilRadarFacetIndex([]),
    kpis: initialPriceRadarKpis,
    requestKey: null,
    fingerprint: null,
    lastUpdated: null,
    loadedAt: null,
    isRevalidating: false,
    error: null,
    filters: { ...initialPriceRadarFilters },
    ui: {
      facetFilters: null,
      page: 1,
      pageSize: 10,
    },
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function updateCache(nextCache: BrazilRadarSnapshotCache) {
  cache = nextCache;
  notify();
}

function defaultSnapshotFetcher(filters: PriceRadarFilters): Promise<PriceRadarSnapshotResponse> {
  return Promise.all([listPriceQuotes(filters), getPriceRadarKpis(filters)]).then(([items, kpis]) => ({
    items,
    kpis,
  }));
}

function serializeFilters(filters: PriceRadarFilters): string {
  return [
    filters.search,
    filters.productId,
    filters.supplierId,
    filters.city,
    filters.quality,
    filters.deliveryTime,
    filters.status,
    filters.sort,
  ].join('\u001f');
}

function updateHash(hash: number, value: string): number {
  let nextHash = hash;
  for (let index = 0; index < value.length; index += 1) {
    nextHash ^= value.charCodeAt(index);
    nextHash = Math.imul(nextHash, 0x01000193);
  }
  return nextHash >>> 0;
}

export function fingerprintPriceRadarSnapshot(items: PriceQuoteItem[]): string {
  let hash = 0x811c9dc5;
  let latestUpdatedAt = '';

  for (const item of items) {
    if (item.updatedAt > latestUpdatedAt) {
      latestUpdatedAt = item.updatedAt;
    }

    const fields = [
      item.id,
      item.source ?? '',
      item.sourceQuoteId ?? '',
      item.catalogProductId ?? '',
      item.productId ?? '',
      item.supplierId,
      item.productName,
      item.productDescription ?? '',
      item.category,
      item.model,
      item.color,
      item.capacity,
      item.productType,
      item.quality,
      item.supplier.id,
      item.supplier.name,
      item.supplier.contact ?? '',
      item.supplier.phone ?? '',
      item.supplier.source ?? '',
      item.supplier.whatsappLink ?? '',
      item.city,
      item.deliveryTime,
      item.contact,
      item.notes,
      String(item.costProduct),
      item.quoteDate,
      item.updatedAt,
      item.status,
      String(item.valid),
      item.inconsistencies.join('\u001e'),
    ];

    hash = updateHash(hash, fields.join('\u001f'));
  }

  return `${items.length}:${latestUpdatedAt}:${hash.toString(36)}`;
}

function areKpisEqual(left: PriceRadarKpis, right: PriceRadarKpis): boolean {
  return (
    left.lowestValidPrice === right.lowestValidPrice &&
    left.averagePrice === right.averagePrice &&
    left.highestPrice === right.highestPrice &&
    left.hiddenCount === right.hiddenCount
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel carregar o Radar de Precos.';
}

export function getBrazilRadarSnapshotCache(): BrazilRadarSnapshotCache {
  return cache;
}

export function subscribeToBrazilRadarSnapshotCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPriceRadarRequestKey(filters: PriceRadarFilters): string {
  return serializeFilters(filters);
}

export function hasBrazilRadarSnapshot(filters: PriceRadarFilters): boolean {
  return cache.requestKey === getPriceRadarRequestKey(filters) && cache.loadedAt !== null;
}

export function isBrazilRadarSnapshotStale(
  filters: PriceRadarFilters,
  now = Date.now(),
): boolean {
  return !hasBrazilRadarSnapshot(filters) || !cache.loadedAt || now - cache.loadedAt >= BRAZIL_RADAR_STALE_TIME_MS;
}

export function setBrazilRadarFilters(
  nextFilters: PriceRadarFilters | ((current: PriceRadarFilters) => PriceRadarFilters),
) {
  const filters =
    typeof nextFilters === 'function' ? nextFilters(cache.filters) : nextFilters;

  if (getPriceRadarRequestKey(filters) === getPriceRadarRequestKey(cache.filters)) {
    return;
  }

  updateCache({
    ...cache,
    filters,
    error: null,
  });
}

export function updateBrazilRadarUiState(nextUi: Partial<BrazilRadarUiState>) {
  updateCache({
    ...cache,
    ui: {
      ...cache.ui,
      ...nextUi,
    },
  });
}

export function clearBrazilRadarSnapshotCache() {
  requestSequence += 1;
  inFlightRequest = null;
  updateCache(createInitialCache());
}

export function revalidateBrazilRadarSnapshot(
  filters: PriceRadarFilters,
  fetcher: PriceRadarSnapshotFetcher = defaultSnapshotFetcher,
): Promise<BrazilRadarRevalidationResult> {
  const key = getPriceRadarRequestKey(filters);
  if (inFlightRequest?.key === key) {
    return inFlightRequest.promise;
  }

  const requestId = ++requestSequence;
  updateCache({
    ...cache,
    isRevalidating: true,
    error: null,
  });

  const promise = fetcher(filters)
    .then(({ items, kpis }) => {
      if (inFlightRequest?.id !== requestId) {
        return { changed: false };
      }

      const fingerprint = fingerprintPriceRadarSnapshot(items);
      const changed = cache.fingerprint !== fingerprint;
      const latestUpdatedAt = items.reduce<string | null>((latest, item) => {
        if (!latest || item.updatedAt > latest) return item.updatedAt;
        return latest;
      }, null);

      updateCache({
        ...cache,
        items: changed ? items : cache.items,
        visibleItems: changed ? items.filter(isVisibleRadarQuote) : cache.visibleItems,
        facetIndex: changed
          ? buildBrazilRadarFacetIndex(items.filter(isVisibleRadarQuote))
          : cache.facetIndex,
        kpis: areKpisEqual(cache.kpis, kpis) ? cache.kpis : kpis,
        requestKey: key,
        fingerprint,
        lastUpdated: latestUpdatedAt,
        loadedAt: Date.now(),
        isRevalidating: false,
        error: null,
      });
      inFlightRequest = null;
      return { changed };
    })
    .catch((error: unknown) => {
      if (inFlightRequest?.id === requestId) {
        updateCache({
          ...cache,
          isRevalidating: false,
          error: toErrorMessage(error),
        });
        inFlightRequest = null;
      }
      throw error;
    });

  inFlightRequest = { id: requestId, key, promise };
  return promise;
}

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearBrazilRadarSnapshotCache);
}
