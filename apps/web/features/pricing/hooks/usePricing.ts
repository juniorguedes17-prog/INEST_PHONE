'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  calculateBrazilRadarQuotePricing,
  generateOfferDraft,
  listPricing,
  recalculatePricing,
} from '../services/pricing-service';
import {
  BrazilRadarQuotePricing,
  BrazilRadarPricingBatchStorage,
  BRAZIL_RADAR_PRICING_STORAGE_KEY,
  OfferDraft,
  OfferDraftBatchStorage,
  PricingFilters,
  PricingItem,
  PricingOfferTarget,
  TemporaryImportPricing,
  TEMPORARY_IMPORT_PRICING_STORAGE_KEY,
  TEMPORARY_OFFER_DRAFT_STORAGE_KEY,
} from '../types/pricing';
import { prepareOfferDraftBatch } from '../services/offer-draft-batch';
import {
  getCanonicalCapacities,
  getCanonicalCategory,
  getCanonicalColors,
  getCanonicalModelKey,
  normalizeCatalogFilterText,
} from '@/features/price-radar/utils/brazil-radar-facets';
import {
  createProduct,
  getProduct,
  getProductReferences,
  listProducts,
  updateProduct,
} from '@/features/products/services/products-service';
import { emptyProductFilters, resolveProfitRegistration } from '../utils/profit-registration';

const initialFilters: PricingFilters = {
  productId: '',
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
};

export function usePricing() {
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [filters, setFilters] = useState<PricingFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [temporaryImportPricing, setTemporaryImportPricing] =
    useState<TemporaryImportPricing | null>(null);
  const [brazilRadarPricings, setBrazilRadarPricings] = useState<BrazilRadarQuotePricing[]>([]);
  const offerBatchPending = useRef(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(TEMPORARY_IMPORT_PRICING_STORAGE_KEY);
    if (!stored) return;

    window.sessionStorage.removeItem(TEMPORARY_IMPORT_PRICING_STORAGE_KEY);
    try {
      setTemporaryImportPricing(JSON.parse(stored) as TemporaryImportPricing);
      setSuccess('Precificacao temporaria do Radar Paraguai carregada.');
    } catch {
      setError('Nao foi possivel carregar a precificacao temporaria do Radar Paraguai.');
    }
  }, [pathname]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(BRAZIL_RADAR_PRICING_STORAGE_KEY);
    if (!stored) return;

    window.sessionStorage.removeItem(BRAZIL_RADAR_PRICING_STORAGE_KEY);
    try {
      const prepared = JSON.parse(stored) as BrazilRadarQuotePricing | BrazilRadarPricingBatchStorage;
      const batch = toBrazilRadarPricingBatch(prepared);
      setBrazilRadarPricings(batch.items);
      setSuccess(
        batch.failedCount
          ? `${batch.items.length} cotacoes carregadas; ${batch.failedCount} nao puderam ser enviadas.`
          : batch.items.length === 1
            ? 'Cotacao do Radar Brasil carregada.'
            : `${batch.items.length} cotacoes do Radar Brasil carregadas.`,
      );
    } catch {
      setError('Nao foi possivel carregar a cotacao do Radar Brasil.');
    }
  }, [pathname]);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get('productId');
    if (!productId) return;

    if (!isUuid(productId)) {
      setError('Identificador de produto invalido. Retorne ao Radar e envie a cotacao novamente.');
      return;
    }

    setFilters((current) =>
      current.productId === productId ? current : { ...current, productId },
    );
  }, [pathname]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listPricing(toPricingRequestFilters(filters)));
    } catch (pricingError) {
      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Nao foi possivel carregar a precificacao.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recalculate() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      setItems(await recalculatePricing(toPricingRequestFilters(filters)));
      setSuccess('Precos recalculados dinamicamente.');
    } catch (pricingError) {
      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Nao foi possivel recalcular os precos.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateOffer(productId: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const draft = await generateOfferDraft(productId);
      sendOfferDraft({ ...draft, source: 'pricing' });
    } catch (pricingError) {
      setError(
        pricingError instanceof Error ? pricingError.message : 'Nao foi possivel gerar a oferta.',
      );
    } finally {
      setSaving(false);
    }
  }

  function generateTemporaryOffer() {
    if (!temporaryImportPricing) return;
    const isIphone = /iphone/i.test(temporaryImportPricing.product.name);
    const productType = isIphone
      ? temporaryImportPricing.profit.condition === 'NOVO'
        ? 'IPHONE_SEALED'
        : 'IPHONE_USED'
      : 'ACCESSORY';

    sendOfferDraft({ ...temporaryImportPricing.offerDraft, productType, source: 'temporary-import' });
  }

  function generateBrazilRadarOffer(item: BrazilRadarQuotePricing) {
    sendOfferDraft(toBrazilRadarOfferDraft(item));
  }

  async function prepareOfferBatch(targets: PricingOfferTarget[]) {
    if (!targets.length || offerBatchPending.current) return null;

    offerBatchPending.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await prepareOfferDraftBatch(targets, async (target) => {
        if (target.kind === 'catalog') {
          return { ...(await generateOfferDraft(target.productId)), source: 'pricing' };
        }

        return toBrazilRadarOfferDraft(target.item);
      });

      if (!result.drafts.length) {
        setError(result.errors[0] ?? 'Nenhuma oferta pode ser preparada.');
      }

      return result;
    } finally {
      offerBatchPending.current = false;
      setSaving(false);
    }
  }

  function sendOfferDraftBatch(drafts: OfferDraft[], failedCount: number) {
    const batch: OfferDraftBatchStorage = { drafts, failedCount };
    window.sessionStorage.setItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY, JSON.stringify(batch));
    router.push('/offers');
  }

  function toBrazilRadarOfferDraft(item: BrazilRadarQuotePricing): OfferDraft {
    if (!item.offerDraft) {
      throw new Error('A cotacao nao esta pronta para gerar oferta.');
    }

    const isIphone = /iphone/i.test(item.product.name);
    const productType = isIphone
      ? item.profit.condition === 'NOVO'
        ? 'IPHONE_SEALED'
        : 'IPHONE_USED'
      : 'ACCESSORY';

    return {
      ...item.offerDraft,
      productType,
      source: 'radar-quote',
    };
  }

  async function registerBrazilRadarProfit(item: BrazilRadarQuotePricing, netProfit: string) {
    setSaving(true);
    setSuccess(null);
    try {
      const catalogProduct = item.catalogProductId
        ? await getProduct(item.catalogProductId)
        : null;
      const [products, references] = catalogProduct
        ? [[], { categories: [], models: [], colors: [], storages: [] }]
        : await Promise.all([listProducts(emptyProductFilters), getProductReferences()]);
      const registration = resolveProfitRegistration({
        item,
        netProfit,
        products,
        references,
        catalogProduct,
      });

      if (registration.action === 'incomplete') {
        throw new Error(registration.message);
      }

      if (registration.action === 'update') {
        await updateProduct(registration.productId, registration.payload);
      } else {
        await createProduct(registration.payload).catch(async (createError) => {
          if (
            !(createError instanceof Error) ||
            !/ja existe|conflit|duplicad/i.test(createError.message)
          ) {
            throw createError;
          }

          const productsAfterConflict = await listProducts(emptyProductFilters);
          const retry = resolveProfitRegistration({
            item,
            netProfit,
            products: productsAfterConflict,
            references,
          });

          if (retry.action === 'update') {
            await updateProduct(retry.productId, retry.payload);
            return;
          }

          throw createError;
        });
      }

      const recalculated = await calculateBrazilRadarQuotePricing({
        sourceQuoteId: item.sourceQuoteId,
      });
      setBrazilRadarPricings((current) =>
        current.map((currentItem) =>
          currentItem.sourceQuoteId === recalculated.sourceQuoteId ? recalculated : currentItem,
        ),
      );

      if (recalculated.calculationStatus !== 'ready') {
        throw new Error(
          recalculated.calculationError ??
            'O Lucro Liquido foi salvo, mas a cotacao ainda nao pode ser recalculada.',
        );
      }

      setSuccess('Lucro Liquido salvo e cotacao recalculada.');
    } finally {
      setSaving(false);
    }
  }

  function sendOfferDraft(draft: OfferDraft) {
    window.sessionStorage.setItem(TEMPORARY_OFFER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    router.push(draft.route);
  }

  return {
    items: filterPricingItems(items, filters),
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    temporaryImportPricing,
    brazilRadarPricings,
    recalculate,
    generateOffer,
    generateTemporaryOffer,
    generateBrazilRadarOffer,
    prepareOfferBatch,
    sendOfferDraftBatch,
    registerBrazilRadarProfit,
  };
}

function toBrazilRadarPricingBatch(
  prepared: BrazilRadarQuotePricing | BrazilRadarPricingBatchStorage,
): BrazilRadarPricingBatchStorage {
  if ('items' in prepared && Array.isArray(prepared.items)) {
    return prepared;
  }

  return { items: [prepared as BrazilRadarQuotePricing], failedCount: 0 };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toPricingRequestFilters(filters: PricingFilters): PricingFilters {
  return {
    ...filters,
    search: '',
    category: '',
    model: '',
    color: '',
    capacity: '',
  };
}

function filterPricingItems(items: PricingItem[], filters: PricingFilters) {
  const normalizedSearch = normalizeCatalogFilterText(filters.search);
  const minimum = filters.minPrice === '' ? Number.NEGATIVE_INFINITY : Number(filters.minPrice);
  const maximum = filters.maxPrice === '' ? Number.POSITIVE_INFINITY : Number(filters.maxPrice);

  return items.filter((item) => {
    const searchable = normalizeCatalogFilterText(
      `${item.productName} ${item.category} ${item.model} ${item.color} ${item.capacity}`,
    );
    const colors = getCanonicalColors(item);
    const capacities = getCanonicalCapacities(item);

    return (
      (!normalizedSearch || searchable.includes(normalizedSearch)) &&
      (!filters.category || getCanonicalCategory(item) === filters.category) &&
      (!filters.model || getCanonicalModelKey(item) === filters.model) &&
      (!filters.color || colors.includes(filters.color)) &&
      (!filters.capacity || capacities.includes(filters.capacity)) &&
      (!filters.productType || item.productType === filters.productType) &&
      (!filters.status || item.status === filters.status) &&
      ((filters.minPrice === '' && filters.maxPrice === '') ||
        (item.salePrice !== null && item.salePrice >= minimum && item.salePrice <= maximum))
    );
  });
}
