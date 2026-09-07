import { describe, expect, it } from 'vitest';
import { compactSourceEvidence } from './usa-source-evidence';
import { adaptUsaSourceProduct } from './usa-source-product.adapter';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { deriveShippingWeightKey } from './shipping-weights/shipping-weight-key-deriver';

describe('USA source evidence transport', () => {
  it('strips markup and scripts and bounds the runtime evidence', () => {
    expect(compactSourceEvidence('<script>private script</script><b>Canon</b> EOS R50')).toBe(
      'Canon EOS R50',
    );
    expect(compactSourceEvidence('x'.repeat(3000))).toHaveLength(2000);
  });
  it('preserves discovery semantics and compact evidence through the adapter', () => {
    const source = adaptUsaSourceProduct({
      providerName: 'apple_us',
      product: {
        id: 'apple-us:IPHONE17PRO_MAIN',
        name: 'iPhone 17 Pro Main',
        store: 'Apple Store USA',
        retailer: 'Apple Store USA',
        category: 'iPhone',
        priceUsd: 1099,
        productUrl: 'https://www.apple.com/shop/buy-iphone/iphone-17-pro',
        offerKind: 'FAMILY_STARTING_AT',
        sourceEvidence: '<h2>iPhone 17 Pro and Pro Max</h2>',
      },
    });
    expect(source).toMatchObject({
      offerKind: 'FAMILY_STARTING_AT',
      sourceEvidence: 'iPhone 17 Pro and Pro Max',
      priceUsd: 1099,
    });
    expect(source.capacity).toBeUndefined();
    expect(
      deriveShippingWeightKey({
        manufacturer: { status: 'RESOLVED', manufacturerKey: 'apple' },
        productIdentity: deriveExtendedProductIdentity({
          productName: source.sourceName,
          quality: 'NOVO',
        }),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).toMatchObject({ status: 'KEY_INSUFFICIENT' });
  });
});
