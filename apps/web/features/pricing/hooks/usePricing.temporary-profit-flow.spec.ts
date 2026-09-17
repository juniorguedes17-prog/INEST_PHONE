import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import test, { mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import { resolveProfitRegistration } from '../utils/profit-registration';

const hookDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(`${hookDirectory}/usePricing.ts`, 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('persiste o lucro do payload real do modal e recalcula a importacao temporaria', async () => {
  const recalculationRequest = {
    origin: 'PY',
    sourceProductId: 'py-mac-mini-m4-pro',
    productName: 'Apple Mac Mini MCX44LL/A Apple M4 Pro / Memória 24GB / SSD 512GB',
    displayName: 'Apple Mac Mini MCX44LL/A Apple M4 Pro / Memória 24GB / SSD 512GB',
    category: 'Mac Mini',
    priceUsd: 650,
    totalCost: 3418.93,
    model: 'Apple Mac Mini MCX44LL/A Apple M4 Pro',
    capacity: '512GB',
    ram: '24GB',
    chip: 'M4 Pro',
    screenSize: null,
    connectivity: null,
    condition: 'NOVO' as const,
  };
  const item = {
    temporary: true,
    origin: 'PY',
    catalogProductId: null,
    financialClassification: 'APPLE',
    financialClassificationReason: 'apple_registry',
    manufacturerKey: null,
    manufacturerProvenance: 'APPLE_CANONICAL_REGISTRY',
    calculationStatus: 'missing_profit',
    calculationError: 'Lucro liquido nao cadastrado para este modelo e condicao.',
    recalculationRequest,
    product: {
      id: null,
      name: recalculationRequest.productName,
      category: 'Mac Mini',
      brand: 'Apple',
      model: recalculationRequest.model,
      capacity: '512GB',
      ram: '24GB',
      chip: 'M4 Pro',
      screenSize: null,
      connectivity: null,
      color: '',
      supplier: 'Loja PY',
      store: 'Loja PY',
      city: '',
      productUrl: '',
      priceUsd: 650,
      isAppleOriginal: null,
    },
    importCosts: { totalCost: 3418.93 },
    desiredNetProfit: null,
    margin: null,
    salePrice: null,
    offerPrice: null,
    pricingCosts: {},
    profit: {
      condition: 'NOVO',
      productDescription: 'Apple Mac Mini MCX44LL/A Apple M4 Pro 24GB 512GB',
    },
    offerDraft: null,
  };
  const createProduct = mock.fn(async (payload: Record<string, unknown>) => {
    void payload;
    return { id: 'product-mac-mini' };
  });
  const calculateTemporaryImportPricing = mock.fn(async (request: typeof recalculationRequest) => {
    void request;
    return {
      ...item,
      catalogProductId: 'product-mac-mini',
      calculationStatus: 'ready',
      calculationError: null,
    };
  });
  const references = {
    categories: [{ id: 'category-mac', name: 'MacBook', type: 'MACBOOK' }],
    models: [
      {
        id: 'model-mac-mini',
        categoryId: 'category-mac',
        name: 'Mac Mini',
        normalizedName: 'mac-mini',
        productType: 'MACBOOK',
      },
    ],
    colors: [],
    storages: [{ id: 'storage-512', displayName: '512GB' }],
  };
  const exported: { usePricing?: () => Record<string, unknown> } = {};
  const noOp = async () => undefined;

  runInNewContext(code, {
    exports: exported,
    URLSearchParams,
    window: { location: { search: '' }, sessionStorage: { getItem: () => null } },
    require: (name: string) => {
      if (name === 'react') {
        return {
          useCallback: (callback: unknown) => callback,
          useEffect: () => undefined,
          useRef: (current: unknown) => ({ current }),
          useState: (initial: unknown) => [initial, () => undefined],
        };
      }
      if (name === 'next/navigation') {
        return { usePathname: () => '/pricing', useRouter: () => ({ push: () => undefined }) };
      }
      if (name.endsWith('/pricing-service')) {
        return {
          calculateBrazilRadarQuotePricing: noOp,
          confirmBrazilRadarManufacturer: noOp,
          confirmTemporaryImportCondition: noOp,
          confirmTemporaryImportManufacturer: noOp,
          calculateTemporaryImportPricing,
          generateOfferDraft: noOp,
          getBrazilRadarPricingWorkSnapshot: noOp,
          listPricing: noOp,
          recalculatePricing: noOp,
        };
      }
      if (name.endsWith('/offers-service')) return { replaceOffersWorkSnapshot: noOp };
      if (name.endsWith('/types/pricing')) {
        return { TEMPORARY_IMPORT_PRICING_STORAGE_KEY: 'temporary-import-pricing' };
      }
      if (name.endsWith('/offer-draft-batch')) return { prepareOfferDraftBatch: noOp };
      if (name.endsWith('/offer-draft-price')) {
        return { applyOfferDraftPrice: (draft: unknown) => draft };
      }
      if (name.endsWith('/brazil-radar-facets')) {
        return {
          getCanonicalCapacities: () => [],
          getCanonicalCategory: () => '',
          getCanonicalColors: () => [],
          getCanonicalModelKey: () => '',
          normalizeCatalogFilterText: (value: string) => value,
        };
      }
      if (name.endsWith('/products-service')) {
        return {
          createProfitRegistration: noOp,
          createProduct,
          getProduct: noOp,
          getProductReferences: async () => references,
          listProducts: async () => [],
          updateProduct: noOp,
        };
      }
      if (name.endsWith('/profit-registration')) {
        return {
          emptyProductFilters: {
            search: '',
            categoryId: '',
            modelId: '',
            status: '',
            productType: '',
            colorId: '',
            storageId: '',
          },
          resolveProfitRegistration,
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });

  assert.ok(exported.usePricing);
  const pricing = exported.usePricing();
  const register = pricing.registerTemporaryImportProfit as (
    pricingItem: typeof item,
    netProfit: string,
  ) => Promise<void>;

  await register(item, '1.500,00');

  assert.equal(createProduct.mock.callCount(), 1);
  const createPayload = createProduct.mock.calls[0]?.arguments[0] as Record<string, unknown>;
  assert.equal(createPayload.modelId, 'model-mac-mini');
  assert.equal(createPayload.storageId, 'storage-512');
  assert.equal(createPayload.profitCondition, 'NOVO');
  assert.equal(createPayload.netProfit, '1.500,00');
  assert.equal(calculateTemporaryImportPricing.mock.callCount(), 1);
  assert.equal(calculateTemporaryImportPricing.mock.calls[0]?.arguments[0], recalculationRequest);
});
