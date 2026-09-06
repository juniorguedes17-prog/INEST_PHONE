import { describe, expect, it, vi } from 'vitest';
import type { UsaProductEnrichmentCandidate } from '../../evolution-webhook/product-normalization.service';
import type { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import type { UsaLunaEnrichmentShadowService } from './usa-luna-enrichment-shadow.service';
import { UsaLunaEnrichmentValidatorService } from './usa-luna-enrichment-validator.service';

function candidate(overrides: Partial<UsaProductEnrichmentCandidate> = {}) {
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
  } satisfies UsaProductEnrichmentCandidate;
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
  lunaCandidate: UsaProductEnrichmentCandidate | null,
  manufacturerResolution: unknown = { status: 'MISSING', normalizedEvidence: '' },
  lunaErrorCode?: string,
) {
  const shadow = {
    observe: vi.fn().mockResolvedValue([
      {
        sourceProductId: 'source-id',
        provider: 'provider',
        deterministicState: 'INSUFFICIENT',
        lunaCalled: Boolean(lunaCandidate),
        result: lunaCandidate
          ? {
              candidate: lunaCandidate,
              latencyMs: 12,
              errorCode: lunaErrorCode,
            }
          : lunaErrorCode
            ? { candidate: null, latencyMs: null, errorCode: lunaErrorCode }
            : null,
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
  it('validates a MacBook candidate through existing Product Identity without mutating its source product', async () => {
    const source = product({ category: 'MacBook' });
    const before = structuredClone(source);
    const { service } = createService(
      candidate({
        manufacturerCandidate: 'Apple',
        categoryCandidate: 'MacBook',
        familyCandidate: 'macbook',
        modelCandidate: 'MacBook Air M5 13"',
        storageCandidate: '512GB',
        ramCandidate: '16GB',
        chipCandidate: 'M5',
        screenCandidate: '13"',
        colorCandidate: 'Midnight',
        conditionCandidate: 'NOVO',
      }),
    );

    const result = await service.enrich(source);

    expect(result.validatedFields).toEqual(
      expect.arrayContaining([
        'manufacturer',
        'model',
        'storage',
        'ram',
        'chip',
        'screen',
        'color',
      ]),
    );
    expect(result.fields.model).toMatchObject({ value: 'MacBook Air M5 13"' });
    expect(result.fields.condition).toMatchObject({
      value: 'NOVO',
      provenance: 'LUNA_VALIDATED',
      candidateStatus: 'VALIDATED',
    });
    expect(source).toEqual(before);
    expect(result.logisticClassification.classification).toBe('OTHER');
  });

  it('allows partial validation for an abbreviated iPhone without inventing unavailable fields', async () => {
    const { service } = createService(
      candidate({
        categoryCandidate: 'iPhone',
        familyCandidate: 'iphone',
        modelCandidate: 'iPhone 17 Pro Max',
        storageCandidate: '256GB',
        colorCandidate: 'Orange',
        conditionCandidate: 'NOVO',
      }),
    );

    const result = await service.enrich(
      product({
        sourceName: 'APL 17PM 256 ORG US',
        sourceProductId: 'amazon-us:abbreviated',
        providerName: 'amazon_us',
        category: '',
        retailer: 'Amazon',
      }),
    );

    expect(result.fields.model).toMatchObject({
      value: 'iPhone 17 Pro Max',
      provenance: 'LUNA_VALIDATED',
      candidateStatus: 'VALIDATED',
    });
    expect(result.fields.storage).toMatchObject({ provenance: 'LUNA_VALIDATED' });
    expect(result.fields.ram).toMatchObject({ value: null, candidateStatus: null });
    expect(result.logisticClassification.classification).toBe('CELULAR');
  });

  it('validates a registered non-Apple manufacturer but leaves unsupported Canon model fields insufficient', async () => {
    const { service, manufacturers } = createService(
      candidate({
        manufacturerCandidate: 'Canon',
        categoryCandidate: 'Camera',
        modelCandidate: 'EOS Rebel T7',
      }),
      {
        status: 'FOUND',
        manufacturerId: 'canon-id',
        manufacturerKey: 'canon',
        canonicalName: 'Canon',
        provenance: 'AI_CANDIDATE_VALIDATED',
        normalizedEvidence: 'canon',
        matchedAlias: 'Canon',
        normalizedAlias: 'canon',
      },
    );

    const result = await service.enrich(
      product({
        sourceName: 'Canon EOS Rebel T7 DSLR Camera',
        category: '',
        retailer: 'B&H Photo Video',
        sourceManufacturer: null,
      }),
    );

    expect(manufacturers.resolve).toHaveBeenCalledWith({
      evidence: 'Canon',
      matchMode: 'EXACT_ALIAS',
      provenance: 'AI_CANDIDATE_VALIDATED',
    });
    expect(result.fields.manufacturer).toMatchObject({
      value: 'Canon',
      provenance: 'LUNA_VALIDATED',
      candidateStatus: 'VALIDATED',
    });
    expect(result.fields.model).toMatchObject({ value: null, candidateStatus: 'INSUFFICIENT' });
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
  ])('maps Manufacturer %s without creating an identity', async (_name, resolution, status) => {
    const { service } = createService(candidate({ manufacturerCandidate: 'Canon' }), resolution);

    const result = await service.enrich(product({ sourceManufacturer: null }));

    expect(result.fields.manufacturer).toMatchObject({ value: null, candidateStatus: status });
  });

  it('preserves authoritative source condition on Luna conflict', async () => {
    const { service } = createService(candidate({ conditionCandidate: 'SEMINOVO' }));

    const result = await service.enrich(product({ condition: 'NOVO' }));

    expect(result.fields.condition).toEqual({
      value: 'NOVO',
      provenance: 'SOURCE',
      candidateStatus: 'CONFLICT',
    });
  });

  it('preserves authoritative source manufacturer on Luna conflict', async () => {
    const { service } = createService(candidate({ manufacturerCandidate: 'Nikon' }), {
      status: 'FOUND',
      manufacturerId: 'nikon-id',
      manufacturerKey: 'nikon',
      canonicalName: 'Nikon',
      provenance: 'AI_CANDIDATE_VALIDATED',
      normalizedEvidence: 'nikon',
      matchedAlias: 'Nikon',
      normalizedAlias: 'nikon',
    });

    const result = await service.enrich(product({ sourceManufacturer: 'Canon' }));

    expect(result.fields.manufacturer).toEqual({
      value: 'Canon',
      provenance: 'SOURCE',
      candidateStatus: 'CONFLICT',
    });
  });

  it('preserves an authoritative source model on Luna conflict', async () => {
    const { service } = createService(candidate({ modelCandidate: 'MacBook Air M5 13"' }));

    const result = await service.enrich(
      product({ sourceName: 'MacBook Pro M5 14 16GB 512GB', model: 'MacBook Pro M5 14"' }),
    );

    expect(result.fields.model).toMatchObject({
      value: 'MacBook Pro M5 14"',
      provenance: 'SOURCE',
      candidateStatus: 'CONFLICT',
    });
  });

  it('continues with deterministic context when Luna has no valid candidate', async () => {
    const { service, shadow } = createService(null, undefined, 'timeout');
    const source = product({ sourceName: 'iPhone 17 Pro 256GB', category: 'iPhone' });

    const result = await service.enrich(source);

    expect(shadow.observe).toHaveBeenCalledWith([source]);
    expect(result.lunaErrorCode).toBe('timeout');
    expect(result.fields.model).toMatchObject({
      value: 'iPhone 17 Pro',
      provenance: 'DETERMINISTIC',
    });
    expect(result.fields).not.toHaveProperty('retailer');
    expect(result.sourceProduct).toBe(source);
  });

  it('does not alter commercial, fiscal, weight, or cost fields', async () => {
    const source = product({
      providerName: 'upcitemdb_us',
      sourceProductId: 'upc:123',
      retailer: null,
      sourceUrl: 'https://example.test/original',
      priceUsd: 777,
    });
    const { service } = createService(candidate({ modelCandidate: 'iPhone 17 Pro' }));

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
