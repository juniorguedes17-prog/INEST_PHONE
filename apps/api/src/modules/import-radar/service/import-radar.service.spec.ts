import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { ImportRadarService } from './import-radar.service';
import { ProductNormalizationService } from '../../evolution-webhook/product-normalization.service';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';

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
  manufacturerResolver?: Pick<ManufacturersService, 'resolve'> &
    Partial<Pick<ManufacturersService, 'confirm'>>,
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
    manufacturerResolver as ManufacturersService | undefined,
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

  it('authorizes a registry-resolved explicit-source Non-Apple item without a canonical Product', async () => {
    const manufacturerResolver = {
      resolve: vi.fn().mockResolvedValue({
        status: 'FOUND',
        manufacturerId: 'manufacturer-canon',
        manufacturerKey: 'canon',
        canonicalName: 'Canon',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
        normalizedEvidence: 'canon',
        matchedAlias: 'Canon',
        normalizedAlias: 'canon',
      }),
    };
    const result = await createService([], undefined, manufacturerResolver).calculate(
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
      financialClassificationReason: 'manufacturer_registry',
      manufacturerKey: 'canon',
      pricingEligibility: { status: 'ELIGIBLE', reason: null },
    });
  });

  it('fails closed for an explicit manufacturer missing from the registry', async () => {
    const manufacturerResolver = {
      resolve: vi.fn().mockResolvedValue({ status: 'MISSING', normalizedEvidence: 'novamarca' }),
    };
    const result = await createService([], undefined, manufacturerResolver).calculate(
      {
        ...importProduct,
        name: 'Camera NovaMarca X1',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        condition: undefined,
        sourceManufacturer: 'NovaMarca',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'UNRESOLVED',
      financialClassificationReason: 'manufacturer_missing',
      pricingEligibility: {
        status: 'NEEDS_INPUT',
        reason: 'classification_unresolved',
        inputType: 'MANUFACTURER',
        diagnosticReason: 'manufacturer_missing',
        input: { type: 'MANUFACTURER', suggestedValue: 'NovaMarca' },
      },
    });
  });

  it('confirms a missing external manufacturer and recalculates only that import item', async () => {
    const manufacturerResolver = {
      resolve: vi
        .fn()
        .mockResolvedValueOnce({ status: 'MISSING', normalizedEvidence: 'garmin' })
        .mockResolvedValueOnce({
          status: 'FOUND',
          manufacturerId: 'manufacturer-garmin',
          manufacturerKey: 'garmin',
          canonicalName: 'Garmin',
          provenance: 'EXPLICIT_SOURCE_VALIDATED',
          normalizedEvidence: 'garmin',
          matchedAlias: 'Garmin',
          normalizedAlias: 'garmin',
        }),
      confirm: vi.fn().mockResolvedValue({ status: 'FOUND' }),
    };
    const result = await createService([], undefined, manufacturerResolver).confirmManufacturer(
      {
        ...importProduct,
        name: 'Garmin Vivoactive 6',
        category: 'Smartwatch',
        model: undefined,
        capacity: undefined,
        condition: 'CPO',
        sourceManufacturer: 'Garmin',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        confirmation: { canonicalName: 'Garmin' },
      },
      { id: 'settings-user' } as never,
    );

    expect(manufacturerResolver.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalName: 'Garmin',
        userId: 'settings-user',
        context: expect.objectContaining({ sourceProductId: importProduct.id }),
      }),
    );
    expect(result).toMatchObject({
      financialClassification: 'NON_APPLE',
      manufacturerKey: 'garmin',
      pricingEligibility: { status: 'ELIGIBLE' },
    });
  });

  it('rejects Apple before an external manufacturer can be confirmed', async () => {
    const manufacturerResolver = {
      resolve: vi.fn(),
      confirm: vi.fn(),
    };
    await expect(
      createService([], undefined, manufacturerResolver).confirmManufacturer(
        {
          ...importProduct,
          sourceManufacturer: 'Apple',
          sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
          confirmation: { canonicalName: 'Apple' },
        },
        { id: 'settings-user' } as never,
      ),
    ).rejects.toThrow('Produto Apple');
    expect(manufacturerResolver.confirm).not.toHaveBeenCalled();
  });

  it('fails closed for an explicit manufacturer with ambiguous registry matches', async () => {
    const manufacturerResolver = {
      resolve: vi.fn().mockResolvedValue({
        status: 'AMBIGUOUS',
        normalizedEvidence: 'orbit',
        manufacturerKeys: ['orbit-a', 'orbit-b'],
      }),
    };
    const result = await createService([], undefined, manufacturerResolver).calculate(
      {
        ...importProduct,
        name: 'Camera Orbit X1',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        condition: undefined,
        sourceManufacturer: 'Orbit',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'UNRESOLVED',
      financialClassificationReason: 'manufacturer_ambiguous',
      pricingEligibility: { status: 'BLOCKED', reason: 'classification_unresolved' },
    });
  });

  it('does not resolve Apple through the external manufacturer registry', async () => {
    const manufacturerResolver = { resolve: vi.fn() };
    const result = await createService([], undefined, manufacturerResolver).calculate(
      {
        ...importProduct,
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'APPLE',
      financialClassificationReason: 'apple_registry',
    });
    expect(manufacturerResolver.resolve).not.toHaveBeenCalled();
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
