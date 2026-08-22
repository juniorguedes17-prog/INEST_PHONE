import { describe, expect, it } from 'vitest';
import { ProductIdentityShadowResultStore } from './product-identity-shadow-store';
import type {
  ProductIdentityShadowObservation,
  ProductIdShadowReason,
} from './product-identity-shadow';

function observation(
  productName: string,
  family: string,
  canonicalModelKey: string,
  status: 'FOUND' | 'MISSING' | 'AMBIGUOUS',
  productId?: string,
  candidates?: string[],
  reason?: ProductIdShadowReason,
): ProductIdentityShadowObservation {
  return {
    item: { productName, rawLine: productName } as never,
    identity: {
      variant: { family, status: 'valid', key: canonicalModelKey },
      canonical: { canonicalModelKey },
    } as never,
    productResolution: {
      status,
      productId,
      candidates,
      reason,
      candidateCount: candidates?.length ?? (status === 'FOUND' ? 1 : 0),
    },
  };
}

describe('ProductIdentityShadowResultStore', () => {
  it('aggregates VM2 observations without recalculating or persisting them', () => {
    const store = new ProductIdentityShadowResultStore();
    store.record([
      observation('MacBook Neo A18 Pro 13 8/256', 'macbook', 'macbook-neo-13', 'FOUND', 'neo-256'),
      observation(
        'iPad 11 A16 256 Wi-Fi',
        'ipad',
        'ipad-11-a16',
        'MISSING',
        undefined,
        undefined,
        'catalog_no_match',
      ),
      observation(
        'Apple Watch Series 11 42mm GPS',
        'apple-watch',
        'apple-watch-series-11-42',
        'FOUND',
        'watch-42',
      ),
      observation(
        'iPhone 17 Air 256GB',
        'iphone',
        'iphone-17-air',
        'AMBIGUOUS',
        undefined,
        ['iphone-a', 'iphone-b'],
        'multiple_catalog_candidates',
      ),
    ]);

    expect(store.summary()).toEqual({
      totalProcessed: 4,
      found: 2,
      missing: 1,
      ambiguous: 1,
      foundIncorrectSuspects: 0,
      checks: {
        macbookNeo: expect.objectContaining({ resolvedProductId: 'neo-256' }),
        ipad: expect.objectContaining({ status: 'MISSING', reason: 'catalog_no_match' }),
        appleWatch: expect.objectContaining({ resolvedProductId: 'watch-42' }),
        iphone17Air: expect.objectContaining({
          candidates: ['iphone-a', 'iphone-b'],
          reason: 'multiple_catalog_candidates',
        }),
      },
      missingSamples: [
        expect.objectContaining({
          rawDescription: 'iPad 11 A16 256 Wi-Fi',
          reason: 'catalog_no_match',
        }),
      ],
      ambiguousSamples: [
        expect.objectContaining({
          candidates: ['iphone-a', 'iphone-b'],
          reason: 'multiple_catalog_candidates',
        }),
      ],
      vm2: 'RELEASED',
    });
  });

  it('limits diagnostic samples and blocks an audit with no observations', () => {
    const store = new ProductIdentityShadowResultStore();
    store.record(
      Array.from({ length: 11 }, (_, index) =>
        observation(`Unknown ${index}`, 'unknown', '', 'MISSING'),
      ),
    );

    expect(store.summary().missingSamples).toHaveLength(10);
    expect(store.summary().vm2).toBe('RELEASED');
    store.reset();
    expect(store.summary().vm2).toBe('BLOCKED');
  });
});
