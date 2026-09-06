import { describe, expect, it } from 'vitest';
import { OfferItemIdentityError, resolveOfferItemIdentity } from './offers.external-identity';

describe('resolveOfferItemIdentity', () => {
  it('keeps an existing Product as the canonical identity', () => {
    expect(
      resolveOfferItemIdentity({
        productId: 'catalog-product-id',
        externalIdentity: {
          origin: 'US',
          provider: 'amazon_us',
          sourceProductId: 'B0EXTERNAL',
        },
      }),
    ).toEqual({ kind: 'CANONICAL', productId: 'catalog-product-id' });
  });

  it('resolves a complete USA external identity without a Product', () => {
    expect(
      resolveOfferItemIdentity({
        externalIdentity: {
          origin: 'US',
          provider: 'amazon_us',
          sourceProductId: 'B0EXTERNAL',
          sourceName: 'Canon EOS Rebel T7',
          sourceUrl: 'https://www.amazon.com/dp/B0EXTERNAL',
          retailer: 'Amazon',
        },
      }),
    ).toEqual({
      kind: 'EXTERNAL',
      productId: null,
      externalIdentity: {
        origin: 'US',
        provider: 'amazon_us',
        sourceProductId: 'B0EXTERNAL',
        sourceName: 'Canon EOS Rebel T7',
        sourceUrl: 'https://www.amazon.com/dp/B0EXTERNAL',
        retailer: 'Amazon',
      },
    });
  });

  it.each([
    { provider: 'amazon_us', sourceProductId: 'B0EXTERNAL' },
    { origin: 'US' as const, sourceProductId: 'B0EXTERNAL' },
    { origin: 'US' as const, provider: 'amazon_us' },
  ])('rejects an incomplete external identity: %#', (externalIdentity) => {
    expect(() => resolveOfferItemIdentity({ externalIdentity })).toThrow(OfferItemIdentityError);
  });
});
