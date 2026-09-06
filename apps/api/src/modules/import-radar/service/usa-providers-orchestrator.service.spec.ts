import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ImportSearchQueryDto } from '../dto/import-radar.dto';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { UsaProvidersOrchestrator } from './usa-providers-orchestrator.service';

type UsaProviderStub = {
  name: string;
  searchUsaSourceProducts: ReturnType<typeof vi.fn>;
};

describe('UsaProvidersOrchestrator', () => {
  it('queries Apple, Amazon, and UPCitemdb together while preserving each source provenance', async () => {
    const apple = provider('apple_us', [source('apple_us', { retailer: 'Apple Store USA' })]);
    const amazon = provider('amazon_us', [source('amazon_us', { retailer: 'Amazon' })]);
    const upc = provider('upcitemdb_us', [
      source('upcitemdb_us', { retailer: 'Best Buy' }),
      source('upcitemdb_us', { retailer: 'B&H Photo Video' }),
      source('upcitemdb_us', { retailer: 'Adorama' }),
    ]);
    const orchestrator = createOrchestrator(apple, amazon, upc);

    const results = await orchestrator.search({ search: 'camera' });

    expect(results).toHaveLength(5);
    expect(results.map((result) => [result.providerName, result.retailer])).toEqual([
      ['apple_us', 'Apple Store USA'],
      ['amazon_us', 'Amazon'],
      ['upcitemdb_us', 'Best Buy'],
      ['upcitemdb_us', 'B&H Photo Video'],
      ['upcitemdb_us', 'Adorama'],
    ]);
    expect(apple.searchUsaSourceProducts).toHaveBeenCalledTimes(1);
    expect(amazon.searchUsaSourceProducts).toHaveBeenCalledTimes(1);
    expect(upc.searchUsaSourceProducts).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Apple', 'apple_us'],
    ['Amazon', 'amazon_us'],
    ['UPCitemdb 429', 'upcitemdb_us'],
    ['UPCitemdb timeout', 'upcitemdb_us'],
  ])('keeps independently successful providers when %s fails', async (_label, failedProvider) => {
    const apple = provider('apple_us', [source('apple_us', { retailer: 'Apple Store USA' })]);
    const amazon = provider('amazon_us', [source('amazon_us', { retailer: 'Amazon' })]);
    const upc = provider('upcitemdb_us', [source('upcitemdb_us', { retailer: 'Best Buy' })]);
    const failed = [apple, amazon, upc].find((candidate) => candidate.name === failedProvider)!;
    failed.searchUsaSourceProducts.mockRejectedValue(
      new ServiceUnavailableException(`${_label} indisponivel`),
    );

    const results = await createOrchestrator(apple, amazon, upc).search({ search: 'phone' });

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.providerName !== failedProvider)).toBe(true);
  });

  it('returns a controlled error only when every provider is unavailable', async () => {
    const apple = provider('apple_us', [], new Error('apple unavailable'));
    const amazon = provider('amazon_us', [], new Error('amazon unavailable'));
    const upc = provider('upcitemdb_us', [], new Error('rate limit'));

    await expect(
      createOrchestrator(apple, amazon, upc).search({ search: 'phone' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('keeps equal names from different retailers as separate offers without fuzzy dedupe', async () => {
    const apple = provider('apple_us', [
      source('apple_us', { sourceName: 'Shared Product', retailer: 'Apple Store USA' }),
    ]);
    const amazon = provider('amazon_us', [
      source('amazon_us', { sourceName: 'Shared Product', retailer: 'Amazon' }),
    ]);
    const upc = provider('upcitemdb_us', [
      source('upcitemdb_us', { sourceName: 'Shared Product', retailer: 'Best Buy' }),
    ]);

    const results = await createOrchestrator(apple, amazon, upc).search({ search: 'shared' });

    expect(results).toHaveLength(3);
    expect(new Set(results.map((result) => result.retailer))).toEqual(
      new Set(['Apple Store USA', 'Amazon', 'Best Buy']),
    );
  });

  it('does not promote a Walmart aggregator offer to a retailer or TAX decision', async () => {
    const apple = provider('apple_us', []);
    const amazon = provider('amazon_us', []);
    const upc = provider('upcitemdb_us', [source('upcitemdb_us', { retailer: null })]);

    const [result] = await createOrchestrator(apple, amazon, upc).search({ search: 'walmart' });

    expect(result).toMatchObject({ providerName: 'upcitemdb_us', retailer: null });
    expect(result).not.toHaveProperty('taxTreatment');
    expect(result).not.toHaveProperty('finalCost');
    expect(result).not.toHaveProperty('shippingUsd');
  });
});

function createOrchestrator(apple: UsaProviderStub, amazon: UsaProviderStub, upc: UsaProviderStub) {
  return new UsaProvidersOrchestrator(apple as never, amazon as never, upc as never);
}

function provider(name: string, products: UsaSourceProduct[], rejection?: Error): UsaProviderStub {
  const searchUsaSourceProducts =
    vi.fn<(query: ImportSearchQueryDto) => Promise<UsaSourceProduct[]>>();
  if (rejection) searchUsaSourceProducts.mockRejectedValue(rejection);
  else searchUsaSourceProducts.mockResolvedValue(products);
  return { name, searchUsaSourceProducts };
}

function source(providerName: string, overrides: Partial<UsaSourceProduct> = {}): UsaSourceProduct {
  const sourceProductId = overrides.sourceProductId ?? `${providerName}:product`;
  const sourceName = overrides.sourceName ?? 'Example Product';
  return {
    providerName,
    sourceProductId,
    sourceName,
    displayName: sourceName,
    source: 'US',
    sourceUrl: `https://example.test/${encodeURIComponent(sourceProductId)}`,
    supplier: providerName,
    sourceManufacturer: null,
    sourceManufacturerProvenance: null,
    retailer: null,
    category: 'Electronics',
    priceUsd: 100,
    ...overrides,
  };
}
