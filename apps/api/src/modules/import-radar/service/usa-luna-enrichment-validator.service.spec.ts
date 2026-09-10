import { describe, expect, it, vi } from 'vitest';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import type {
  ProductSemanticNormalizationCandidate,
  ProductSemanticNormalizationStatus,
} from '../../evolution-webhook/product-normalization.service';
import type { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { sourceSemanticText } from '../usa-source-evidence';
import { resolveLogisticProductClassification } from '../logistic-product-classification';
import { UsaEnrichmentInputDecisionService } from './usa-enrichment-input-decision.service';
import type { UsaLunaEnrichmentShadowService } from './usa-luna-enrichment-shadow.service';
import { UsaLunaEnrichmentValidatorService } from './usa-luna-enrichment-validator.service';

function candidate(overrides: Partial<ProductSemanticNormalizationCandidate> = {}) {
  return {
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
  } satisfies ProductSemanticNormalizationCandidate;
}

function product(overrides: Partial<UsaSourceProduct> = {}): UsaSourceProduct {
  const sourceName = overrides.sourceName ?? 'Apple MacBook Air 13 M5 16GB 512GB Midnight';
  return {
    providerName: 'apple_us',
    sourceProductId: 'apple-us:macbook-air-m5',
    sourceName,
    displayName: sourceName,
    source: 'US',
    sourceUrl: 'https://example.test/product',
    supplier: 'Apple USA',
    sourceManufacturer: null,
    sourceManufacturerProvenance: null,
    retailer: 'Apple Store USA',
    category: 'MacBook',
    priceUsd: 1499,
    ...overrides,
  };
}

function createService(
  lunaCandidate: ProductSemanticNormalizationCandidate | null,
  manufacturerResolution: unknown = { status: 'MISSING', normalizedEvidence: '' },
  status: ProductSemanticNormalizationStatus = lunaCandidate ? 'CANDIDATE' : 'MODEL_ERROR',
  lunaErrorCode?: string,
) {
  const shadow = {
    observe: vi.fn().mockResolvedValue([
      {
        sourceProductId: 'source-id',
        provider: 'provider',
        lunaCalled: status !== 'SKIPPED_NOT_ELIGIBLE',
        result: {
          context: 'NORMALIZE_PRICING_US',
          source: 'US',
          normalizationStatus: status,
          candidate: lunaCandidate,
          schemaValid: status === 'CANDIDATE',
          lunaCalled: status !== 'SKIPPED_NOT_ELIGIBLE',
          model: 'gpt-5.6-luna',
          inputTokens: null,
          outputTokens: null,
          estimatedCostUsd: null,
          latencyMs: lunaCandidate ? 12 : null,
          errorCode: lunaErrorCode,
        },
      },
    ]),
  };
  const manufacturers = { resolve: vi.fn().mockResolvedValue(manufacturerResolution) };
  return {
    shadow,
    manufacturers,
    service: new UsaLunaEnrichmentValidatorService(
      shadow as unknown as UsaLunaEnrichmentShadowService,
      manufacturers as unknown as ManufacturersService,
    ),
  };
}

describe('UsaLunaEnrichmentValidatorService', () => {
  it.each([
    [
      'Samsung',
      'Galaxy S25 Ultra',
      'Samsung Galaxy S25 Ultra 512GB Black Smartphone New',
      'Smartphone',
    ],
    ['Sony', 'Alpha A7 IV', 'Sony Alpha A7 IV Mirrorless Camera Black New', 'Camera'],
    ['Canon', 'EOS Rebel T7', 'Canon EOS Rebel T7 DSLR Camera Black New', 'Camera'],
  ])(
    'accepts source-grounded %s semantics without requiring an Apple/canonical model',
    async (brand, model, sourceName, category) => {
      const { service } = createService(
        candidate({
          manufacturerCandidate: brand,
          categoryCandidate: category,
          modelCandidate: model,
          storageCandidate: null,
        }),
        { status: 'FOUND', canonicalName: brand },
      );

      const result = await service.enrich(
        product({
          sourceName,
          sourceEvidence: sourceName,
          sourceManufacturer: null,
          category: '',
          model: undefined,
          capacity: undefined,
          providerName: 'amazon_us',
          retailer: 'Amazon',
        }),
      );

      expect(result.fields.manufacturer).toMatchObject({
        value: brand,
        provenance: 'LUNA_VALIDATED',
        candidateStatus: 'VALIDATED',
      });
      expect(result.fields.model).toMatchObject({
        value: model,
        provenance: 'LUNA_VALIDATED',
        candidateStatus: 'VALIDATED',
      });
      expect(result.fields.storage).toEqual({
        value: null,
        provenance: null,
        candidateStatus: null,
      });
    },
  );

  it('normalizes the Garmin B0CG6NBJ61 evidence without an Apple model registry', async () => {
    const title = 'Garmin vívoactive 5 Health & Fitness GPS Smartwatch 42mm Ivory';
    const { service, manufacturers } = createService(
      candidate({
        manufacturerCandidate: 'Garmin',
        categoryCandidate: 'Smartwatch',
        familyCandidate: 'vivoactive',
        modelCandidate: 'vivoactive 5',
        screenCandidate: '42mm',
        colorCandidate: 'Ivory',
        connectivityCandidate: 'GPS',
        storageCandidate: null,
      }),
      { status: 'FOUND', canonicalName: 'Garmin' },
    );

    const result = await service.enrich(
      product({
        providerName: 'amazon_us',
        sourceProductId: 'amazon-us:B0CG6NBJ61',
        sourceName: title,
        displayName: title,
        sourceEvidence: `ASIN B0CG6NBJ61 ${title}`,
        sourceManufacturer: null,
        retailer: 'Amazon',
        category: 'Electronics',
        model: undefined,
        capacity: undefined,
        color: undefined,
      }),
    );

    expect(result.semanticNormalizationStatus).toBe('CANDIDATE');
    expect(result.fields).toMatchObject({
      manufacturer: { value: 'Garmin', candidateStatus: 'VALIDATED' },
      category: {
        value: 'Smartwatch',
        provenance: 'LUNA_VALIDATED',
        candidateStatus: 'VALIDATED',
      },
      family: { value: 'vivoactive', candidateStatus: 'VALIDATED' },
      model: { value: 'vivoactive 5', candidateStatus: 'VALIDATED' },
      screen: { value: '42mm', candidateStatus: 'VALIDATED' },
      color: { value: 'Ivory', candidateStatus: 'VALIDATED' },
      connectivity: { value: 'GPS', candidateStatus: 'VALIDATED' },
      storage: { value: null, candidateStatus: null },
    });
    expect(result.logisticClassification.classification).toBe('OTHER');
    expect(
      new UsaEnrichmentInputDecisionService(
        service,
        manufacturers as unknown as ManufacturersService,
      ).decide(result),
    ).toMatchObject({ status: 'READY', reason: null });
  });

  it.each([
    {
      name: 'iPhone new',
      sourceName: 'Apple iPhone 17 Pro 256GB Black New',
      category: 'iPhone',
      model: 'iPhone 17 Pro',
      storage: '256GB',
      color: 'Black',
      condition: 'NOVO' as const,
    },
    {
      name: 'iPhone renewed',
      sourceName: 'Apple iPhone 16 Pro 512GB Natural Titanium Renewed',
      category: 'iPhone',
      model: 'iPhone 16 Pro',
      storage: '512GB',
      color: 'Natural Titanium',
      condition: 'SEMINOVO' as const,
    },
    {
      name: 'MacBook Air',
      sourceName: 'Apple MacBook Air M5 13 16GB 512GB Midnight New',
      category: 'MacBook',
      model: 'MacBook Air M5',
      storage: '512GB',
      color: 'Midnight',
      condition: 'NOVO' as const,
    },
    {
      name: 'MacBook Pro',
      sourceName: 'Apple MacBook Pro M5 14 24GB 1TB Silver New',
      category: 'MacBook',
      model: 'MacBook Pro M5',
      storage: '1TB',
      color: 'Silver',
      condition: 'NOVO' as const,
    },
    {
      name: 'Apple Watch GPS',
      sourceName: 'Apple Watch Series 11 42mm GPS Black New',
      category: 'Apple Watch',
      model: 'Apple Watch Series 11',
      storage: null,
      color: 'Black',
      condition: 'NOVO' as const,
    },
    {
      name: 'Apple Watch Cellular',
      sourceName: 'Apple Watch Ultra 3 49mm GPS Cellular Natural New',
      category: 'Apple Watch',
      model: 'Apple Watch Ultra 3',
      storage: null,
      color: 'Natural',
      condition: 'NOVO' as const,
    },
    {
      name: 'iPad',
      sourceName: 'Apple iPad Air M4 11 256GB Blue WiFi New',
      category: 'iPad',
      model: 'iPad Air M4',
      storage: '256GB',
      color: 'Blue',
      condition: 'NOVO' as const,
    },
  ])('preserves official structured Apple fields for $name', async (testCase) => {
    const source = product({
      sourceName: testCase.sourceName,
      sourceManufacturer: 'Apple',
      category: testCase.category,
      model: testCase.model,
      capacity: testCase.storage ?? undefined,
      color: testCase.color,
      condition: testCase.condition,
    });
    const before = structuredClone(source);
    const { service } = createService(
      candidate({
        manufacturerCandidate: 'Apple',
        categoryCandidate: testCase.category,
        modelCandidate: testCase.model,
        storageCandidate: testCase.storage,
        colorCandidate: testCase.color,
        conditionCandidate: testCase.condition,
      }),
    );

    const result = await service.enrich(source);

    expect(result.fields.manufacturer.value).toBe('Apple');
    expect(result.fields.model.value).toBe(testCase.model);
    expect(result.fields.storage.value).toBe(testCase.storage);
    expect(result.fields.color.value).toBe(testCase.color);
    expect(result.fields.condition.value).toBe(testCase.condition);
    expect(result.conflictFields).toEqual([]);
    expect(source).toEqual(before);

    const financialHandoffA = {
      category: source.category,
      model: source.model ?? null,
      capacity: source.capacity ?? null,
      color: source.color ?? null,
      condition: source.condition ?? null,
    };
    const financialHandoffB = {
      category: result.fields.category.value,
      model: result.fields.model.value,
      capacity: result.fields.storage.value,
      color: result.fields.color.value,
      condition: result.fields.condition.value,
    };
    expect(financialHandoffB).toEqual(financialHandoffA);

    const identityA = deriveExtendedProductIdentity({
      productName: sourceSemanticText(source),
      category: source.category,
      model: source.model,
      capacity: source.capacity,
      color: source.color,
      quality: source.condition,
    });
    expect(result.logisticClassification).toEqual(
      resolveLogisticProductClassification({
        productIdentity: identityA,
        canonicalCategory: source.category,
      }),
    );
  });

  it('uses mechanical evidence binding for Unicode, reordered words, units, and model abbreviations', async () => {
    const { service } = createService(
      candidate({
        modelCandidate: 'iPhone 17 Pro Max',
        storageCandidate: '256GB',
        screenCandidate: '42mm',
      }),
    );

    const result = await service.enrich(
      product({
        sourceName: 'APL 17PM 256 GB Ivory 42 mm',
        sourceEvidence: 'vívoactive Ivory Garmin',
        category: '',
        model: undefined,
        capacity: undefined,
      }),
    );

    expect(result.fields.model).toMatchObject({
      value: 'iPhone 17 Pro Max',
      candidateStatus: 'VALIDATED',
    });
    expect(result.fields.storage).toMatchObject({ value: '256GB', candidateStatus: 'VALIDATED' });
    expect(result.fields.screen).toMatchObject({ value: '42mm', candidateStatus: 'VALIDATED' });
  });

  it('keeps absent and unsupported attributes null instead of inventing them', async () => {
    const { service } = createService(
      candidate({
        manufacturerCandidate: 'Canon',
        modelCandidate: 'EOS R50',
        storageCandidate: '512GB',
        ramCandidate: '64GB',
      }),
      { status: 'FOUND', canonicalName: 'Canon' },
    );

    const result = await service.enrich(
      product({
        sourceName: 'Canon EOS R50 Mirrorless Camera Black',
        category: '',
        model: undefined,
        capacity: undefined,
      }),
    );

    expect(result.fields.storage).toEqual({
      value: null,
      provenance: null,
      candidateStatus: 'INSUFFICIENT',
    });
    expect(result.fields.ram).toEqual({
      value: null,
      provenance: null,
      candidateStatus: 'INSUFFICIENT',
    });
  });

  it.each([
    ['MISSING', { status: 'MISSING', normalizedEvidence: 'canon' }, 'INSUFFICIENT'],
    [
      'AMBIGUOUS',
      {
        status: 'AMBIGUOUS',
        normalizedEvidence: 'canon',
        manufacturerKeys: ['canon', 'canon-pro'],
      },
      'CONFLICT',
    ],
  ])(
    'preserves the existing Manufacturer resolution result %s',
    async (_name, resolution, status) => {
      const { service } = createService(candidate({ manufacturerCandidate: 'Canon' }), resolution);

      const result = await service.enrich(
        product({ sourceName: 'Canon Camera', sourceManufacturer: null }),
      );

      expect(result.fields.manufacturer).toMatchObject({ value: null, candidateStatus: status });
      expect(result.candidateValues.manufacturer).toBe('Canon');
    },
  );

  it('does not promote a Luna value that contradicts an explicit source field', async () => {
    const { service } = createService(candidate({ modelCandidate: 'MacBook Air M5 13' }));

    const result = await service.enrich(
      product({
        sourceName: 'Listing text MacBook Air M5 13 but structured model MacBook Pro M5 14',
        model: 'MacBook Pro M5 14',
      }),
    );

    expect(result.fields.model).toEqual({
      value: 'MacBook Pro M5 14',
      provenance: 'SOURCE',
      candidateStatus: 'CONFLICT',
    });
  });

  it.each([
    ['TIMEOUT', 'timeout'],
    ['MODEL_ERROR', 'model_unavailable'],
    ['INVALID_STRUCTURED_OUTPUT', 'invalid_structured_output'],
    ['SKIPPED_DISABLED', 'circuit_open'],
    ['BUDGET_EXHAUSTED', 'daily_budget_exhausted'],
  ] as const)(
    'does not reactivate deterministic semantic parsing after %s',
    async (status, errorCode) => {
      const { service, shadow } = createService(null, undefined, status, errorCode);
      const source = product({
        sourceName: 'iPhone 17 Pro 256GB Black',
        category: '',
        model: undefined,
        capacity: undefined,
        color: undefined,
      });

      const result = await service.enrich(source);

      expect(shadow.observe).toHaveBeenCalledWith([source]);
      expect(result.semanticNormalizationStatus).toBe(status);
      expect(result.lunaErrorCode).toBe(errorCode);
      expect(result.fields.model).toEqual({
        value: null,
        provenance: null,
        candidateStatus: null,
      });
      expect(result.fields.storage.value).toBeNull();
    },
  );

  it('does not alter or derive commercial, fiscal, weight, or cost fields', async () => {
    const source = product({
      providerName: 'upcitemdb_us',
      sourceProductId: 'upc:123',
      retailer: null,
      sourceUrl: 'https://example.test/original',
      priceUsd: 777,
    });
    const { service } = createService(candidate({ modelCandidate: 'MacBook Air' }));

    const result = await service.enrich(source);

    expect(result.sourceProduct).toMatchObject({
      providerName: 'upcitemdb_us',
      sourceProductId: 'upc:123',
      retailer: null,
      sourceUrl: 'https://example.test/original',
      priceUsd: 777,
    });
    expect(result).not.toHaveProperty('taxTreatment');
    expect(result).not.toHaveProperty('shippingWeightLbs');
    expect(result).not.toHaveProperty('finalCost');
  });
});
