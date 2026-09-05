'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  calculateBrazilRadarQuotePricing,
  calculateTemporaryImportPricing,
  generateOfferDraft,
  getBrazilRadarPricingWorkSnapshot,
  listPricing,
  recalculatePricing,
} from '../services/pricing-service';
import { replaceOffersWorkSnapshot } from '@/features/offers/services/offers-service';
import {
  BrazilRadarQuotePricing,
  OfferDraft,
  OfferDraftBatchStorage,
  PricingFilters,
  PricingItem,
  PricingOfferTarget,
  TemporaryImportPricing,
  TEMPORARY_IMPORT_PRICING_STORAGE_KEY,
} from '../types/pricing';
import { prepareOfferDraftBatch } from '../services/offer-draft-batch';
import { applyOfferDraftPrice } from '../services/offer-draft-price';
import {
  getCanonicalCapacities,
  getCanonicalCategory,
  getCanonicalColors,
  getCanonicalModelKey,
  normalizeCatalogFilterText,
} from '@/features/price-radar/utils/brazil-radar-facets';
import {
  createProfitRegistration,
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

export function usePricing({
  includeOfferIncrement = true,
  offerIncrement,
}: {
  includeOfferIncrement?: boolean;
  offerIncrement?: number;
} = {}) {
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
    let active = true;

    async function loadWorkSnapshot() {
      try {
        const batch = await getBrazilRadarPricingWorkSnapshot();
        if (!active || !batch) return;

        setBrazilRadarPricings(batch.items);
        setSuccess(
          batch.failedCount
            ? `${batch.items.length} cotacoes carregadas; ${batch.failedCount} nao puderam ser enviadas.`
            : batch.items.length === 1
              ? 'Cotacao do Radar Brasil carregada.'
              : `${batch.items.length} cotacoes do Radar Brasil carregadas.`,
        );
      } catch {
        if (active) setError('Nao foi possivel carregar a cotacao do Radar Brasil.');
      }
    }

    void loadWorkSnapshot();
    return () => {
      active = false;
    };
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
      await sendOfferDraft(applyOfferPrice({ ...draft, source: 'pricing' }));
    } catch (pricingError) {
      setError(
        pricingError instanceof Error ? pricingError.message : 'Nao foi possivel gerar a oferta.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function generateTemporaryOffer() {
    if (
      !temporaryImportPricing?.offerDraft ||
      temporaryImportPricing.calculationStatus !== 'ready'
    ) {
      return;
    }
    const isIphone = /iphone/i.test(temporaryImportPricing.product.name);
    const productType = isIphone
      ? temporaryImportPricing.profit.condition === 'NOVO'
        ? 'IPHONE_SEALED'
        : 'IPHONE_USED'
      : 'ACCESSORY';

    await sendOfferDraft(
      applyOfferPrice({
        ...temporaryImportPricing.offerDraft,
        productType,
        source: 'temporary-import',
      }),
    );
  }

  async function generateBrazilRadarOffer(item: BrazilRadarQuotePricing) {
    await sendOfferDraft(applyOfferPrice(toBrazilRadarOfferDraft(item)));
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
          return applyOfferPrice({
            ...(await generateOfferDraft(target.productId)),
            source: 'pricing',
          });
        }

        return applyOfferPrice(toBrazilRadarOfferDraft(target.item));
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

  async function sendOfferDraftBatch(drafts: OfferDraft[], failedCount: number) {
    const batch: OfferDraftBatchStorage = { drafts, failedCount };
    await replaceOffersWorkSnapshot(batch);
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
      const catalogProduct = item.catalogProductId ? await getProduct(item.catalogProductId) : null;
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
        const createRegistration =
          registration.action === 'create-model-and-product'
            ? () =>
                createProfitRegistration({
                  product: registration.payload,
                  model: registration.model,
                })
            : () => createProduct(registration.payload);

        await createRegistration().catch(async (createError) => {
          if (
            !(createError instanceof Error) ||
            !/ja existe|conflit|duplicad|unique constraint/i.test(createError.message)
          ) {
            throw createError;
          }

          const [productsAfterConflict, referencesAfterConflict] = await Promise.all([
            listProducts(emptyProductFilters),
            getProductReferences(),
          ]);
          const retry = resolveProfitRegistration({
            item,
            netProfit,
            products: productsAfterConflict,
            references: referencesAfterConflict,
          });

          if (retry.action === 'update') {
            await updateProduct(retry.productId, retry.payload);
            return;
          }

          if (retry.action === 'create') {
            await createProduct(retry.payload);
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

  async function registerTemporaryImportProfit(item: TemporaryImportPricing, netProfit: string) {
    setSaving(true);
    setSuccess(null);
    try {
      if (!item.profit.condition) {
        throw new Error('Condicao financeira nao resolvida para cadastrar o Lucro Liquido.');
      }
      const catalogProduct = item.catalogProductId ? await getProduct(item.catalogProductId) : null;
      const [products, references] = catalogProduct
        ? [[], { categories: [], models: [], colors: [], storages: [] }]
        : await Promise.all([listProducts(emptyProductFilters), getProductReferences()]);
      const registration = resolveProfitRegistration({
        item: toProfitRegistrationItem(item),
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
      } else if (registration.action === 'create-model-and-product') {
        await createProfitRegistration({
          product: registration.payload,
          model: registration.model,
        });
      } else {
        await createProduct(registration.payload);
      }
      const recalculated = await calculateTemporaryImportPricing(item.recalculationRequest);
      setTemporaryImportPricing(recalculated);

      if (recalculated.calculationStatus !== 'ready') {
        throw new Error(
          recalculated.calculationError ??
            'O Lucro Liquido foi salvo, mas a importacao ainda nao pode ser recalculada.',
        );
      }
      setSuccess('Lucro Liquido salvo e importacao recalculada.');
    } finally {
      setSaving(false);
    }
  }

  async function sendOfferDraft(draft: OfferDraft) {
    await replaceOffersWorkSnapshot({ drafts: [draft], failedCount: 0 });
    router.push(draft.route);
  }

  function applyOfferPrice(draft: OfferDraft) {
    return applyOfferDraftPrice(draft, includeOfferIncrement, offerIncrement);
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
    registerTemporaryImportProfit,
  };
}

function toProfitRegistrationItem(item: TemporaryImportPricing): BrazilRadarQuotePricing {
  const condition = item.profit.condition;
  if (!condition) {
    throw new Error('Condicao financeira nao resolvida para cadastrar o Lucro Liquido.');
  }
  return {
    temporary: true,
    origin: 'BR',
    source: 'BRAZIL_RADAR',
    sourceQuoteId: `temporary-py-${item.recalculationRequest.sourceProductId}`,
    catalogProductId: item.catalogProductId,
    calculationStatus: item.calculationStatus === 'ready' ? 'ready' : 'missing_profit',
    calculationError: item.calculationError,
    product: {
      ...item.product,
      condition,
    },
    costProduct: item.importCosts.totalCost,
    desiredNetProfit: item.desiredNetProfit,
    margin: item.margin,
    salePrice: item.salePrice,
    offerPrice: item.offerPrice,
    pricingCosts: item.pricingCosts,
    profit: { ...item.profit, condition },
    offerDraft: item.offerDraft,
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
