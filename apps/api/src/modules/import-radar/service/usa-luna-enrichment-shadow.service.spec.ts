import { describe, expect, it, vi } from 'vitest';
import type { ProductNormalizationService } from '../../evolution-webhook/product-normalization.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  UsaLunaEnrichmentShadowService,
  deriveDeterministicIdentityState,
  shouldCallUsaLuna,
} from './usa-luna-enrichment-shadow.service';

const lunaCandidate = {
  context: 'NORMALIZE_PRICING_US' as const,
  source: 'US' as const,
  normalizationStatus: 'CANDIDATE' as const,
  candidate: {
    manufacturerCandidate: 'Apple',
    categoryCandidate: 'iPhone',
    familyCandidate: 'iphone',
    modelCandidate: 'iPhone 17 Pro',
    storageCandidate: '256GB',
    ramCandidate: null,
    chipCandidate: null,
    screenCandidate: null,
    colorCandidate: 'Orange',
    connectivityCandidate: null,
    conditionCandidate: 'NOVO' as const,
    quantityCandidate: null,
    featureCandidates: [],
    connectorCandidate: null,
    powerCandidate: null,
    lengthCandidate: null,
  },
  schemaValid: true,
  lunaCalled: true,
  model: 'gpt-5.6-luna',
  inputTokens: 10,
  outputTokens: 20,
  estimatedCostUsd: 0.01,
  latencyMs: 15,
};

function product(overrides: Partial<UsaSourceProduct> = {}): UsaSourceProduct {
  const sourceName = overrides.sourceName ?? 'Apple iPhone 17 Pro 256GB Orange';
  return {
    providerName: 'apple_us',
    sourceProductId: 'apple-us:iphone-17-pro-256-orange',
    sourceName,
    displayName: sourceName,
    source: 'US',
    sourceUrl: 'https://example.test/iphone',
    supplier: 'Apple USA',
    sourceManufacturer: 'Apple',
    sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
    retailer: 'Apple Store USA',
    category: 'iPhone',
    model: 'iPhone 17 Pro',
    capacity: '256GB',
    color: 'Orange',
    condition: 'NOVO',
    priceUsd: 1099,
    ...overrides,
  };
}

function createService() {
  const productNormalization = {
    normalizeSemanticProduct: vi.fn().mockResolvedValue(lunaCandidate),
  };
  return {
    productNormalization,
    service: new UsaLunaEnrichmentShadowService(
      productNormalization as unknown as ProductNormalizationService,
    ),
  };
}

describe('UsaLunaEnrichmentShadowService', () => {
  it('never sends family discovery or catalog counts to Luna', async () => {
    const { productNormalization, service } = createService();
    await service.observe([product({ offerKind: 'FAMILY_STARTING_AT', capacity: undefined })]);
    expect(productNormalization.normalizeSemanticProduct).not.toHaveBeenCalled();
    const response = {
      total: 3278,
      items: [
        product({
          category: '',
          model: undefined,
          capacity: undefined,
          sourceName: 'Canon EOS R50 Kit White New',
          sourceEvidence: 'RF-S18-45mm lens kit',
          providerName: 'upcitemdb_us',
        }),
      ],
    };
    await service.observe(response.items);
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
    expect(productNormalization.normalizeSemanticProduct.mock.calls[0]?.[0]).not.toHaveProperty(
      'total',
    );
    expect(productNormalization.normalizeSemanticProduct.mock.calls[0]?.[0]).toMatchObject({
      sourceEvidence: 'RF-S18-45mm lens kit',
    });
  });
  it('hands every purchasable Apple, Amazon, and UPCitemdb product to the shared US normalizer without financial context', async () => {
    const { productNormalization, service } = createService();
    const apple = product({ capacity: undefined });
    const amazon = product({
      providerName: 'amazon_us',
      sourceProductId: 'amazon-us:B0EXAMPLE',
      retailer: 'Amazon',
      sourceManufacturer: null,
      sourceManufacturerProvenance: null,
      capacity: undefined,
    });
    const upc = product({
      providerName: 'upcitemdb_us',
      sourceProductId: 'upcitemdb-us:000123',
      retailer: null,
      sourceManufacturer: null,
      sourceManufacturerProvenance: null,
      capacity: undefined,
      sourceName: 'Walmart listed iPhone 17 Pro',
    });
    const before = structuredClone([apple, amazon, upc]);

    const observations = await service.observe([apple, amazon, upc]);

    expect(observations).toHaveLength(3);
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(3);
    expect(observations.every((entry) => entry.lunaCalled)).toBe(true);
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'NORMALIZE_PRICING_US',
        source: 'US',
        sourceName: 'Walmart listed iPhone 17 Pro',
        structuredFields: expect.objectContaining({ manufacturer: null }),
      }),
    );
    for (const [input] of productNormalization.normalizeSemanticProduct.mock.calls) {
      expect(input).not.toHaveProperty('priceUsd');
      expect(input).not.toHaveProperty('retailer');
      expect(input).not.toHaveProperty('sourceProductId');
      expect(input).not.toHaveProperty('provider');
      expect(JSON.stringify(input)).not.toContain('1099');
    }
    expect([apple, amazon, upc]).toEqual(before);
    expect(upc.retailer).toBeNull();
    expect(observations[2]?.result?.candidate).not.toHaveProperty('retailer');
    expect(observations[2]?.result?.candidate).not.toHaveProperty('priceUsd');
  });

  it('does not call Luna twice for the same provider source product in one execution', async () => {
    const { productNormalization, service } = createService();
    const source = product({ capacity: undefined, sourceName: 'Apple iPhone 17 Pro' });

    const observations = await service.observe([source, { ...source }]);

    expect(observations).toHaveLength(1);
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
  });

  it('calls Luna even when the legacy deterministic identity is RESOLVED', async () => {
    const { productNormalization, service } = createService();
    const source = product({ sourceName: 'iPhone 17 Pro 256GB Orange' });

    const [observation] = await service.observe([source]);

    expect(observation).toMatchObject({
      lunaCalled: true,
      result: { normalizationStatus: 'CANDIDATE' },
    });
    expect(deriveDeterministicIdentityState(source)).toBe('RESOLVED');
    expect(productNormalization.normalizeSemanticProduct).toHaveBeenCalledTimes(1);
  });

  it('contains a Luna failure as a shadow observation', async () => {
    const { productNormalization, service } = createService();
    productNormalization.normalizeSemanticProduct.mockRejectedValue(
      new Error('network unavailable'),
    );

    const [observation] = await service.observe([
      product({ capacity: undefined, sourceName: 'Apple iPhone 17 Pro' }),
    ]);

    expect(observation).toMatchObject({
      lunaCalled: true,
      result: { normalizationStatus: 'MODEL_ERROR', candidate: null },
    });
  });

  it('does not use the deterministic state as a semantic gate', () => {
    const complete = product({ sourceName: 'iPhone 17 Pro 256GB Orange' });
    const incomplete = product({ capacity: undefined });

    expect(deriveDeterministicIdentityState(complete)).toBe('RESOLVED');
    expect(shouldCallUsaLuna(complete)).toBe(true);
    expect(shouldCallUsaLuna(incomplete)).toBe(true);
  });
});
