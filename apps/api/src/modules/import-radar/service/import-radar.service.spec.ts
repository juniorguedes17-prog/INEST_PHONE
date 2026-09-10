import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { ImportRadarService } from './import-radar.service';
import {
  ProductNormalizationService,
  type ProductSemanticNormalizationCandidate,
  type ProductSemanticNormalizationInput,
  type ProductSemanticNormalizationResult,
} from '../../evolution-webhook/product-normalization.service';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import { roundMoneyToCents } from '../validators/import-radar.validators';

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
  productNormalization: Pick<
    ProductNormalizationService,
    'normalizeSemanticProduct'
  > = createSemanticNormalizer(),
  manufacturerResolver?: Pick<ManufacturersService, 'resolve'> &
    Partial<Pick<ManufacturersService, 'confirm'>>,
  importationOverrides?: Partial<{
    dollarQuote: number;
    cdeExitPerBox: number;
    invoiceTaxPercent: number;
    brazilDispatchPerBox: number;
    correiosLabel: number;
  }>,
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
        ...importationOverrides,
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

function semanticCandidate(
  overrides: Partial<ProductSemanticNormalizationCandidate> = {},
): ProductSemanticNormalizationCandidate {
  return {
    commercialName: null,
    manufacturerCandidate: null,
    categoryCandidate: null,
    familyCandidate: null,
    modelCandidate: null,
    storageCandidate: null,
    ramCandidate: null,
    chipCandidate: null,
    screenCandidate: null,
    colorCandidate: null,
    connectivityCandidate: null,
    conditionCandidate: null,
    quantityCandidate: null,
    featureCandidates: [],
    connectorCandidate: null,
    powerCandidate: null,
    lengthCandidate: null,
    ...overrides,
  };
}

function semanticResult(
  overrides: Partial<ProductSemanticNormalizationResult> = {},
): ProductSemanticNormalizationResult {
  return {
    context: 'NORMALIZE_PRICING_PY',
    source: 'PY',
    normalizationStatus: 'CANDIDATE',
    candidate: semanticCandidate(),
    schemaValid: true,
    lunaCalled: true,
    model: 'gpt-5.6-luna',
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.001,
    latencyMs: 10,
    ...overrides,
  };
}

function createSemanticNormalizer() {
  return {
    normalizeSemanticProduct: vi.fn(
      async (
        input: ProductSemanticNormalizationInput,
      ): Promise<ProductSemanticNormalizationResult> =>
        semanticResult({
          candidate: semanticCandidate({
            manufacturerCandidate: input.structuredFields?.manufacturer ?? null,
            categoryCandidate: input.structuredFields?.category ?? null,
            modelCandidate: input.structuredFields?.model ?? null,
            storageCandidate: input.structuredFields?.storage ?? null,
            colorCandidate: input.structuredFields?.color ?? null,
            conditionCandidate:
              input.structuredFields?.condition === 'NOVO' ||
              input.structuredFields?.condition === 'CPO' ||
              input.structuredFields?.condition === 'SEMINOVO'
                ? input.structuredFields.condition
                : null,
          }),
        }),
    ),
  };
}

const importProduct = {
  id: 'external-compras-paraguai-id',
  name: 'iPhone 17 Pro Max 256GB',
  store: 'Loja PY',
  category: 'iPhone',
  priceUsd: 1000,
  productUrl: 'https://example.com/iphone-17',
  sourceEvidence: 'iPhone 17 Pro Max 256GB',
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

  it('normalizes the Canon PY breakdown and total to cents before the Pricing handoff', async () => {
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
    const service = createService([], undefined, manufacturerResolver, {
      dollarQuote: 5.35,
      cdeExitPerBox: 110,
      invoiceTaxPercent: 3,
      brazilDispatchPerBox: 50,
      correiosLabel: 120,
    });

    const result = await service.calculate(
      {
        ...importProduct,
        id: 'py-canon-eos-rebel-t7',
        name: 'Camera Digital Canon EOS Rebel T7 24.1MP - Lente EF-S 18-55mm IS II',
        category: 'Outros',
        priceUsd: 435,
        model: undefined,
        capacity: undefined,
        condition: undefined,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'NON_APPLE',
      pricingEligibility: { status: 'ELIGIBLE' },
      breakdown: {
        convertedPrice: 2327.25,
        cdeExit: 110,
        redirectCost: 0,
        brazilDispatch: 50,
        invoiceTax: 69.82,
        correiosLabel: 120,
      },
      total: 2677.07,
    });
    expect(
      roundMoneyToCents(Object.values(result.breakdown).reduce((sum, value) => sum + value, 0)),
    ).toBe(result.total);
  });

  it('normalizes a second Non-Apple PY product with a fractional tax', async () => {
    const manufacturerResolver = {
      resolve: vi.fn().mockResolvedValue({
        status: 'FOUND',
        manufacturerId: 'manufacturer-nikon',
        manufacturerKey: 'nikon',
        canonicalName: 'Nikon',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
        normalizedEvidence: 'nikon',
        matchedAlias: 'Nikon',
        normalizedAlias: 'Nikon',
      }),
    };
    const service = createService([], undefined, manufacturerResolver, {
      dollarQuote: 5.35,
      cdeExitPerBox: 110,
      invoiceTaxPercent: 3,
      brazilDispatchPerBox: 50,
      correiosLabel: 120,
    });

    const result = await service.calculate(
      {
        ...importProduct,
        id: 'py-nikon-z50',
        name: 'Camera Nikon Z50 20.9MP',
        category: 'Outros',
        priceUsd: 499,
        model: undefined,
        capacity: undefined,
        condition: undefined,
        sourceManufacturer: 'Nikon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'NON_APPLE',
      breakdown: {
        convertedPrice: 2669.65,
        invoiceTax: 80.09,
      },
      total: 3029.74,
    });
    expect(
      roundMoneyToCents(Object.values(result.breakdown).reduce((sum, value) => sum + value, 0)),
    ).toBe(result.total);
  });

  it('keeps Apple PY classification while using the normalized monetary breakdown', async () => {
    const service = createService([], undefined, undefined, {
      dollarQuote: 5.35,
      cdeExitPerBox: 110,
      invoiceTaxPercent: 3,
      brazilDispatchPerBox: 50,
      correiosLabel: 120,
    });

    const result = await service.calculate(
      {
        ...importProduct,
        id: 'py-iphone-17-pro-max',
        name: 'iPhone 17 Pro Max 256GB',
        category: 'iPhone',
        priceUsd: 1000,
        model: 'iPhone 17 Pro Max',
        capacity: '256GB',
        condition: 'NOVO',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      financialClassification: 'APPLE',
      breakdown: {
        convertedPrice: 5350,
        invoiceTax: 160.5,
      },
      total: 5790.5,
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

  it('usa Luna como autoridade primaria mesmo quando a identidade deterministica resolveria', async () => {
    const productNormalization = createSemanticNormalizer();
    const service = createService([], productNormalization);
    const result = await service.calculate(importProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      productResolution: { status: 'MISSING', reason: 'catalog_no_match' },
    });
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'NORMALIZE_PRICING_PY',
        source: 'PY',
        sourceName: importProduct.name,
        sourceEvidence: importProduct.sourceEvidence,
        structuredFields: expect.objectContaining({
          model: importProduct.model,
          storage: importProduct.capacity,
        }),
      }),
    );
  });

  it.each([
    {
      caseName: 'MacBook Air',
      rawName: 'MAC AIR M5 13 16/512 MID',
      legacyName: 'MacBook Air M5 13 16GB 512GB Midnight',
      category: 'MacBook',
      model: 'MacBook Air M5 13" 16GB',
      capacity: '512GB',
      color: 'Midnight',
      candidate: semanticCandidate({
        commercialName: 'Apple MacBook Air M5 13" 16GB/512GB Midnight Novo',
        manufacturerCandidate: 'Apple',
        categoryCandidate: 'MacBook',
        familyCandidate: 'MacBook Air',
        modelCandidate: 'MacBook Air M5',
        chipCandidate: 'M5',
        screenCandidate: '13"',
        ramCandidate: '16GB',
        storageCandidate: '512GB',
        colorCandidate: 'Midnight',
        conditionCandidate: 'NOVO',
      }),
    },
    {
      caseName: 'MacBook Pro',
      rawName: 'MAC PRO M5 14 16/512 SPACE BLACK',
      legacyName: 'MacBook Pro M5 14 16GB 512GB Space Black',
      category: 'MacBook',
      model: 'MacBook Pro M5 14" 16GB',
      capacity: '512GB',
      color: 'Space Black',
      candidate: semanticCandidate({
        commercialName: 'Apple MacBook Pro M5 14" 16GB/512GB Space Black Novo',
        manufacturerCandidate: 'Apple',
        categoryCandidate: 'MacBook',
        familyCandidate: 'MacBook Pro',
        modelCandidate: 'MacBook Pro M5',
        chipCandidate: 'M5',
        screenCandidate: '14"',
        ramCandidate: '16GB',
        storageCandidate: '512GB',
        colorCandidate: 'Space Black',
        conditionCandidate: 'NOVO',
      }),
    },
    {
      caseName: 'iPhone',
      rawName: 'IPH 17 PRO MAX 256 NAT',
      legacyName: 'iPhone 17 Pro Max 256GB Natural',
      category: 'iPhone',
      model: 'iPhone 17 Pro Max',
      capacity: '256GB',
      color: 'Natural',
      candidate: semanticCandidate({
        commercialName: 'Apple iPhone 17 Pro Max 256GB Natural Novo',
        manufacturerCandidate: 'Apple',
        categoryCandidate: 'iPhone',
        familyCandidate: 'iPhone 17',
        modelCandidate: 'iPhone 17 Pro Max',
        storageCandidate: '256GB',
        colorCandidate: 'Natural',
        conditionCandidate: 'NOVO',
      }),
    },
  ])(
    'adapta o golden PY abreviado de $caseName sem alterar o downstream financeiro',
    async ({ rawName, legacyName, category, model, capacity, color, candidate }) => {
      const luna = {
        normalizeSemanticProduct: vi.fn().mockResolvedValue(semanticResult({ candidate })),
      };
      const rawInput = {
        ...importProduct,
        name: rawName,
        sourceEvidence: `${rawName} Marca Apple`,
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        color: undefined,
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE' as const,
      };
      const legacy = await createService([]).calculate(
        {
          ...rawInput,
          name: legacyName,
          sourceEvidence: legacyName,
          category,
          model,
          capacity,
          color,
        },
        { id: 'user-1' } as never,
      );
      const normalized = await createService([], luna).calculate(rawInput, {
        id: 'user-1',
      } as never);

      expect(normalized.product).toMatchObject({
        name: rawName,
        brand: 'Apple',
        category,
        model,
        capacity,
        color,
        condition: 'NOVO',
      });
      expect(normalized.sourceCommercialIdentity.commercialName).toBe(candidate.commercialName);
      expect({
        productResolution: normalized.productResolution,
        financialClassification: normalized.financialClassification,
        financialClassificationReason: normalized.financialClassificationReason,
        pricingEligibility: normalized.pricingEligibility,
        breakdown: normalized.breakdown,
        total: normalized.total,
      }).toEqual({
        productResolution: legacy.productResolution,
        financialClassification: legacy.financialClassification,
        financialClassificationReason: legacy.financialClassificationReason,
        pricingEligibility: legacy.pricingEligibility,
        breakdown: legacy.breakdown,
        total: legacy.total,
      });
      expect(luna.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
    },
  );

  it('normaliza Samsung PY sem depender do registry Apple', async () => {
    const manufacturerResolver = {
      resolve: vi.fn().mockResolvedValue({
        status: 'FOUND',
        manufacturerId: 'manufacturer-samsung',
        manufacturerKey: 'samsung',
        canonicalName: 'Samsung',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
        normalizedEvidence: 'samsung',
        matchedAlias: 'Samsung',
        normalizedAlias: 'samsung',
      }),
    };
    const luna = {
      normalizeSemanticProduct: vi.fn().mockResolvedValue(
        semanticResult({
          candidate: semanticCandidate({
            commercialName: 'Samsung Galaxy A36 256GB 5G Awesome Lavender Novo',
            manufacturerCandidate: 'Samsung',
            categoryCandidate: 'Smartphone',
            familyCandidate: 'Galaxy A',
            modelCandidate: 'Galaxy A36',
            storageCandidate: '256GB',
            colorCandidate: 'Awesome Lavender',
            connectivityCandidate: '5G',
            conditionCandidate: 'NOVO',
          }),
        }),
      ),
    };
    const result = await createService([], luna, manufacturerResolver).calculate(
      {
        ...importProduct,
        name: 'Samsung Galaxy A36 5G Dual 256GB Awesome Lavender',
        sourceEvidence:
          'Samsung Galaxy A36 5G Dual 256GB Awesome Lavender Categoria Smartphone Marca Samsung',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        color: undefined,
        sourceManufacturer: 'Samsung',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      product: {
        brand: 'Samsung',
        category: 'Smartphone',
        model: 'Galaxy A36',
        capacity: '256GB',
        color: 'Awesome Lavender',
      },
      financialClassification: 'NON_APPLE',
      financialClassificationReason: 'manufacturer_registry',
      pricingEligibility: { status: 'ELIGIBLE', reason: null },
      sourceCommercialIdentity: {
        commercialName: 'Samsung Galaxy A36 256GB 5G Awesome Lavender Novo',
      },
    });
  });

  it('mantem atributos nao aplicaveis como null sem inventar storage para camera', async () => {
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
    const luna = {
      normalizeSemanticProduct: vi.fn().mockResolvedValue(
        semanticResult({
          candidate: semanticCandidate({
            commercialName: 'Canon EOS Rebel T7 Black',
            manufacturerCandidate: 'Canon',
            categoryCandidate: 'Camera',
            modelCandidate: 'EOS Rebel T7',
            storageCandidate: null,
            screenCandidate: null,
            colorCandidate: 'Black',
          }),
        }),
      ),
    };
    const result = await createService([], luna, manufacturerResolver).calculate(
      {
        ...importProduct,
        name: 'Canon EOS Rebel T7 Camera Body Black',
        sourceEvidence: 'Canon EOS Rebel T7 Camera Body Black Marca Canon',
        category: 'Outros',
        model: undefined,
        capacity: undefined,
        color: undefined,
        condition: undefined,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      product: {
        category: 'Camera',
        model: 'EOS Rebel T7',
        capacity: undefined,
        color: 'Black',
      },
      financialClassification: 'NON_APPLE',
      pricingEligibility: { status: 'ELIGIBLE' },
      sourceCommercialIdentity: { commercialName: 'Canon EOS Rebel T7 Black' },
    });
  });

  it('keeps PY financial and cost decisions independent from commercialName', async () => {
    const normalizedFields = {
      manufacturerCandidate: 'Apple',
      categoryCandidate: 'iPhone',
      familyCandidate: 'iPhone',
      modelCandidate: 'iPhone 17 Pro Max',
      storageCandidate: '256GB',
      conditionCandidate: 'NOVO' as const,
    };
    const calculateWithName = (commercialName: string) =>
      createService([], {
        normalizeSemanticProduct: vi.fn().mockResolvedValue(
          semanticResult({
            candidate: semanticCandidate({ ...normalizedFields, commercialName }),
          }),
        ),
      }).calculate(importProduct, { id: 'user-1' } as never);

    const first = await calculateWithName('iPhone 17 Pro Max 256GB Novo');
    const reordered = await calculateWithName('Novo 256GB iPhone 17 Pro Max');

    expect(first.sourceCommercialIdentity.commercialName).toBe('iPhone 17 Pro Max 256GB Novo');
    expect(reordered.sourceCommercialIdentity.commercialName).toBe('Novo 256GB iPhone 17 Pro Max');
    expect({ ...reordered, sourceCommercialIdentity: first.sourceCommercialIdentity }).toEqual(
      first,
    );
  });

  it('nao promove atributo Luna sem grounding na fonte', async () => {
    const luna = {
      normalizeSemanticProduct: vi.fn().mockResolvedValue(
        semanticResult({
          candidate: semanticCandidate({
            modelCandidate: 'Google Pixel 99 Pro',
            storageCandidate: '1TB',
            conditionCandidate: 'NOVO',
          }),
        }),
      ),
    };
    const result = await createService([catalogProduct()], luna).calculate(importProduct, {
      id: 'user-1',
    } as never);

    expect(result).toMatchObject({
      product: { model: undefined, capacity: undefined },
      catalogProductId: null,
      financialClassification: 'UNRESOLVED',
      pricingEligibility: { status: 'BLOCKED' },
    });
  });

  it('falha fechada em conflito entre fabricante explicito e candidato Luna', async () => {
    const luna = {
      normalizeSemanticProduct: vi.fn().mockResolvedValue(
        semanticResult({
          candidate: semanticCandidate({
            manufacturerCandidate: 'Samsung',
            modelCandidate: 'Galaxy S26 Ultra',
            conditionCandidate: 'NOVO',
          }),
        }),
      ),
    };
    const result = await createService([], luna).calculate(
      {
        ...importProduct,
        sourceEvidence: `${importProduct.name} Samsung`,
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      },
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      product: { model: undefined, capacity: undefined },
      catalogProductId: null,
      pricingEligibility: { status: 'BLOCKED', reason: 'financial_identity_insufficient' },
    });
  });

  it.each([
    ['TIMEOUT', 'timeout'],
    ['MODEL_ERROR', 'model_error'],
    ['MODEL_ERROR', 'circuit_open'],
    ['MODEL_ERROR', 'api_unavailable'],
    ['INVALID_STRUCTURED_OUTPUT', 'invalid_structured_output'],
    ['BUDGET_EXHAUSTED', 'budget_exhausted'],
  ] as const)(
    'falha fechada em %s sem reativar a identidade heuristica antiga',
    async (normalizationStatus, errorCode) => {
      const productNormalization = {
        normalizeSemanticProduct: vi.fn().mockResolvedValue(
          semanticResult({
            normalizationStatus,
            candidate: null,
            schemaValid: false,
            errorCode,
          }),
        ),
      };
      const result = await createService([catalogProduct()], productNormalization).calculate(
        importProduct,
        { id: 'user-1' } as never,
      );

      expect(result).toMatchObject({
        product: {
          name: importProduct.name,
          model: undefined,
          capacity: undefined,
          category: '',
        },
        catalogProductId: null,
        productResolution: { status: 'MISSING', reason: 'catalog_no_match' },
        pricingEligibility: {
          status: 'BLOCKED',
          reason: 'financial_identity_insufficient',
        },
      });
      expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
    },
  );

  it('falha fechada quando a chamada Luna rejeita mesmo que a regex antiga resolvesse', async () => {
    const productNormalization = {
      normalizeSemanticProduct: vi.fn().mockRejectedValue(new Error('network unavailable')),
    };
    const result = await createService([catalogProduct()], productNormalization).calculate(
      importProduct,
      { id: 'user-1' } as never,
    );

    expect(result).toMatchObject({
      catalogProductId: null,
      productResolution: { status: 'MISSING' },
      pricingEligibility: { status: 'BLOCKED', reason: 'financial_identity_insufficient' },
    });
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
