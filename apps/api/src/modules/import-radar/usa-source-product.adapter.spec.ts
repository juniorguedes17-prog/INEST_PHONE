import { describe, expect, it } from 'vitest';
import type { ImportProviderProduct } from './interfaces/import-provider.interface';
import {
  adaptUsaSourceProduct,
  UsaSourceProductValidationError,
} from './usa-source-product.adapter';

function providerProduct(overrides: Partial<ImportProviderProduct> = {}): ImportProviderProduct {
  return {
    id: 'source-product-123',
    name: 'iPhone 16 128GB Black',
    store: 'Provider storefront',
    retailer: 'Apple Store USA',
    category: 'iPhone',
    priceUsd: 799,
    productUrl: 'https://source.example/products/123',
    sourceManufacturer: 'Apple',
    sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
    model: 'iPhone 16',
    capacity: '128GB',
    color: 'Black',
    condition: 'NOVO',
    ...overrides,
  };
}

function adapt(
  productOverrides: Partial<ImportProviderProduct> = {},
  providerName = 'fixture-provider',
) {
  return adaptUsaSourceProduct({ providerName, product: providerProduct(productOverrides) });
}

describe('adaptUsaSourceProduct', () => {
  it('creates a USA source product without a canonical Product.id', () => {
    const result = adapt();

    expect(result).toMatchObject({
      providerName: 'fixture-provider',
      sourceProductId: 'source-product-123',
      sourceName: 'iPhone 16 128GB Black',
      source: 'US',
      retailer: 'Apple Store USA',
      sourceManufacturer: 'Apple',
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      priceUsd: 799,
    });
    expect(result).not.toHaveProperty('productId');
  });

  it('keeps retailer, provider, and manufacturer as separate source concepts', () => {
    const result = adapt(
      {
        retailer: 'Best Buy',
        store: 'Aggregator X',
        sourceManufacturer: 'Apple',
      },
      'aggregator-x',
    );

    expect(result.providerName).toBe('aggregator-x');
    expect(result.retailer).toBe('Best Buy');
    expect(result.supplier).toBe('Aggregator X');
    expect(result.sourceManufacturer).toBe('Apple');
  });

  it('retains missing retailer and manufacturer as unresolved source context', () => {
    const result = adapt({
      retailer: null,
      sourceManufacturer: null,
      sourceManufacturerProvenance: undefined,
    });

    expect(result.retailer).toBeNull();
    expect(result.sourceManufacturer).toBeNull();
    expect(result.sourceManufacturerProvenance).toBeNull();
  });

  it('keeps incomplete optional attributes as source context for later fail-closed decisions', () => {
    const result = adapt({
      category: '',
      model: undefined,
      capacity: undefined,
      color: undefined,
      condition: undefined,
    });

    expect(result).toMatchObject({ source: 'US', category: '', priceUsd: 799 });
    expect(result).not.toHaveProperty('model');
    expect(result).not.toHaveProperty('capacity');
  });

  it('does not reject a source product when its URL is absent', () => {
    const result = adapt({ productUrl: '   ' });

    expect(result.sourceUrl).toBe('');
  });

  it('rejects only invalid source-product invariants', () => {
    expectValidationReason(() => adapt({ id: '  ' }), 'SOURCE_PRODUCT_ID_REQUIRED');
    expectValidationReason(() => adapt({ name: '  ' }), 'SOURCE_NAME_REQUIRED');
    expectValidationReason(() => adapt({ priceUsd: 0 }), 'PRICE_USD_INVALID');
    expectValidationReason(() => adapt({ priceUsd: -1 }), 'PRICE_USD_INVALID');
    expectValidationReason(() => adapt({ priceUsd: Number.NaN }), 'PRICE_USD_INVALID');
    expectValidationReason(
      () => adapt({ priceUsd: Number.POSITIVE_INFINITY }),
      'PRICE_USD_INVALID',
    );
    expectValidationReason(() => adapt({ origin: 'PY' }), 'SOURCE_ORIGIN_INVALID');
  });

  it.each([
    ['Apple Store USA', 'apple-store-usa', 'Apple Store USA', 'Apple'],
    ['Amazon', 'amazon', 'Amazon', 'Apple'],
    ['eBay', 'ebay', 'eBay', 'Apple'],
    ['Walmart', 'walmart', 'Walmart', 'Apple'],
    ['Best Buy', 'best-buy', 'Best Buy', 'Apple'],
    ['B&H Photo Video', 'bh-photo-video', 'B&H Photo Video', 'Canon'],
    ['Adorama', 'adorama', 'Adorama', 'Canon'],
  ])(
    'adapts the %s contract fixture without a provider-specific product type',
    (_source, providerName, retailer, manufacturer) => {
      const result = adapt({ retailer, sourceManufacturer: manufacturer }, providerName);

      expect(result.source).toBe('US');
      expect(result.providerName).toBe(providerName);
      expect(result.retailer).toBe(retailer);
      expect(result.sourceManufacturer).toBe(manufacturer);
      expect(result.priceUsd).toBe(799);
    },
  );

  it('does not convert currency or calculate TAX, freight, FinalCost, or logistics decisions', () => {
    const result = adapt();

    expect(result).not.toHaveProperty('priceBrl');
    expect(result).not.toHaveProperty('taxTreatment');
    expect(result).not.toHaveProperty('shippingWeightLbs');
    expect(result).not.toHaveProperty('finalCost');
    expect(result).not.toHaveProperty('logisticClassification');
  });
});

function expectValidationReason(
  operation: () => unknown,
  reason: UsaSourceProductValidationError['reason'],
) {
  try {
    operation();
    throw new Error('Expected USA source product validation to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(UsaSourceProductValidationError);
    expect((error as UsaSourceProductValidationError).reason).toBe(reason);
  }
}
