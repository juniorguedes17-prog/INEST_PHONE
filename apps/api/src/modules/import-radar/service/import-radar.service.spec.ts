import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { ImportRadarService } from './import-radar.service';
import { ProductNormalizationService } from '../../evolution-webhook/product-normalization.service';

const PRODUCT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function catalogProduct(id = PRODUCT_ID): ProductIdShadowCandidate {
  return {
    id,
    productDescription: 'iPhone 17 Pro Max 256GB',
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
    variantAttributes: null,
    category: null,
    model: null,
    color: null,
    storage: { displayName: '256 GB', value: '256', unit: 'GB' },
  };
}

function createService(
  catalog: ProductIdShadowCandidate[],
  productNormalization?: Pick<
    ProductNormalizationService,
    'isPricingNormalizationEnabled' | 'normalize'
  >,
) {
  const repository = {
    listActiveCatalogProducts: vi.fn().mockResolvedValue(catalog),
    createAuditLog: vi.fn(),
  };
  const settings = {
    getSettings: vi.fn().mockResolvedValue({
      importation: {
        dollarQuote: 5,
        cdeExitPerBox: 0,
        invoiceTaxPercent: 0,
        brazilDispatchPerBox: 0,
        correiosLabel: 0,
        redirectRules: [],
      },
    }),
  };
  return new ImportRadarService(
    settings as unknown as SettingsService,
    repository as unknown as ImportRadarRepository,
    {} as MockImportProvider,
    {} as ComprasParaguaiProvider,
    productNormalization as ProductNormalizationService | undefined,
  );
}

const importProduct = {
  id: 'external-compras-paraguai-id',
  name: 'iPhone 17 Pro Max 256GB',
  store: 'Loja PY',
  category: 'iPhone',
  priceUsd: 1000,
  productUrl: 'https://example.com/iphone-17',
  model: 'iPhone 17 Pro Max',
  capacity: '256GB',
  condition: 'NOVO' as const,
};

describe('ImportRadarService catalog product handoff', () => {
  it('uses only the resolved active catalog Product id and structured condition', async () => {
    const result = await createService([catalogProduct()]).calculate(importProduct, {
      id: 'user-1',
    } as never);

    expect(result).toMatchObject({
      catalogProductId: PRODUCT_ID,
      condition: 'NOVO',
      productResolution: { status: 'FOUND', productId: PRODUCT_ID },
    });
    expect(result.catalogProductId).not.toBe(importProduct.id);
  });

  it('fails closed when no active Product matches the imported product', async () => {
    const result = await createService([]).calculate(importProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      condition: 'NOVO',
      productResolution: { status: 'MISSING' },
    });
  });

  it('authorizes an explicit-source Non-Apple item without a canonical Product', async () => {
    const result = await createService([]).calculate(
      {
        ...importProduct,
        name: 'Camera Digital Canon EOS Rebel T7 24.1MP',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        condition: undefined,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      catalogProductId: null,
      financialClassification: 'NON_APPLE',
      pricingEligibility: { status: 'ELIGIBLE', reason: null },
    });
  });

  it('does not authorize inferred manufacturer text without provenance', async () => {
    const result = await createService([]).calculate(
      {
        ...importProduct,
        name: 'Camera Digital Canon EOS Rebel T7 24.1MP',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        condition: undefined,
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'UNRESOLVED',
      pricingEligibility: { status: 'BLOCKED', reason: 'classification_unresolved' },
    });
  });

  it('fails closed when more than one active Product matches the imported product', async () => {
    const result = await createService([
      catalogProduct(),
      catalogProduct('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    ]).calculate(importProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      condition: 'NOVO',
      productResolution: { status: 'AMBIGUOUS', candidateCount: 2 },
    });
  });

  it('observa somente identity_insufficient sem mudar o resultado PY', async () => {
    const productNormalization = {
      isPricingNormalizationEnabled: vi.fn().mockReturnValue(true),
      normalize: vi.fn().mockResolvedValue({ normalizationStatus: 'FOUND' }),
    };
    const service = createService([], productNormalization);
    const incompleteProduct = {
      ...importProduct,
      name: 'MacBook Pro M5 14 512GB',
      category: 'MacBook',
      model: 'MacBook Pro M5 14',
      capacity: '512GB',
    };

    const result = await service.calculate(incompleteProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      productResolution: { status: 'MISSING', reason: 'catalog_no_match' },
    });
    expect(productNormalization.normalize).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'NORMALIZE_PRICING_PY',
        source: 'PY',
        originalReason: 'identity_insufficient',
      }),
      [],
    );
  });

  it('nao observa um Product PY deterministico ou catalog_no_match', async () => {
    const productNormalization = {
      isPricingNormalizationEnabled: vi.fn().mockReturnValue(true),
      normalize: vi.fn(),
    };

    await createService([catalogProduct()], productNormalization).calculate(importProduct, {
      id: 'user-1',
    } as never);
    await createService([], productNormalization).calculate(importProduct, {
      id: 'user-1',
    } as never);

    expect(productNormalization.normalize).not.toHaveBeenCalled();
  });

  it('nao escolhe Product quando a condition da fonte e desconhecida', async () => {
    const result = await createService([catalogProduct()]).calculate(
      { ...importProduct, condition: undefined, name: 'iPhone 17 Pro Max 256GB' },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      catalogProductId: null,
      condition: null,
      productResolution: { status: 'MISSING', reason: 'condition_unresolved' },
    });
  });

  it('resolve cada condition isoladamente sem criar ambiguidade entre Products diferentes', async () => {
    const novo = catalogProduct('novo-product');
    const cpo = {
      ...catalogProduct('cpo-product'),
      profitCondition: 'CPO',
    };

    const result = await createService([novo, cpo]).calculate(
      { ...importProduct, condition: 'NOVO' },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      catalogProductId: 'novo-product',
      condition: 'NOVO',
      productResolution: { status: 'FOUND', productId: 'novo-product', candidateCount: 1 },
    });
  });

  it('mantem AMBIGUOUS para dois candidatos dentro da mesma condition', async () => {
    const result = await createService([
      catalogProduct('novo-a'),
      catalogProduct('novo-b'),
    ]).calculate({ ...importProduct, condition: 'NOVO' }, { id: 'user-1' } as never);

    expect(result.productResolution).toMatchObject({
      status: 'AMBIGUOUS',
      candidateCount: 2,
      reason: 'multiple_catalog_candidates',
    });
  });
});
