import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { describe, expect, it } from 'vitest';
import type { ShippingWeightKeyInput } from './shipping-weight.contract';
import {
  deriveShippingWeightKey,
  SHIPPING_WEIGHT_KEY_VERSION,
} from './shipping-weight-key-deriver';

function appleInput(
  productName: string,
  options: Partial<Pick<ShippingWeightKeyInput, 'composition' | 'sourceContext'>> & {
    color?: string;
    quality?: string;
  } = {},
): ShippingWeightKeyInput {
  return {
    manufacturer: { status: 'RESOLVED', manufacturerKey: 'apple' },
    productIdentity: deriveExtendedProductIdentity({
      productName,
      quality: options.quality ?? 'NOVO',
      color: options.color,
    }),
    composition: options.composition ?? { kind: 'SINGLE_ITEM' },
    sourceContext: options.sourceContext,
  };
}

function resolvedKey(input: ShippingWeightKeyInput) {
  const resolution = deriveShippingWeightKey(input);
  expect(resolution.status).toBe('KEY_RESOLVED');
  if (resolution.status !== 'KEY_RESOLVED')
    throw new Error('Expected a resolved shipping weight key.');
  return resolution.shippingWeightKey;
}

describe('ShippingWeightKeyDeriver', () => {
  it('uses a versioned, canonical and deterministic serialization', () => {
    const input = appleInput('iPhone 16 Pro 256GB LL/A eSIM', { color: 'Black Titanium' });
    const first = resolvedKey(input);
    const second = resolvedKey(input);

    expect(first).toBe(second);
    expect(first.startsWith(`${SHIPPING_WEIGHT_KEY_VERSION}|`)).toBe(true);
    expect(first).toContain('|manufacturer=apple|family=iphone|model=iphone-16-pro|');
    expect(first).toContain('|connectivity=esim|');
    expect(first).toContain('|qualifiers=esim,ll/a');
  });

  it('does not use source/store/supplier/url/displayName, quote id, or price in the key', () => {
    const sourceContext = {
      sourceCommercialIdentity: {
        sourceProductId: 'store-a-id',
        sourceName: 'Store A',
        displayName: 'Completely different listing name',
        source: 'US' as const,
        sourceUrl: 'https://store-a.example/product',
        supplier: 'Supplier A',
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE' as const,
      },
      sourceQuoteId: 'quote-a',
      store: 'Store A',
      priceUsd: 999,
    };
    const otherContext = {
      ...sourceContext,
      sourceCommercialIdentity: {
        ...sourceContext.sourceCommercialIdentity,
        sourceProductId: 'store-b-id',
        sourceName: 'Store B',
        displayName: 'Another unrelated listing title',
        sourceUrl: 'https://store-b.example/other-url',
        supplier: 'Supplier B',
      },
      sourceQuoteId: 'quote-b',
      store: 'Store B',
      priceUsd: 1099,
    };

    expect(resolvedKey(appleInput('iPhone 16 128GB', { sourceContext }))).toBe(
      resolvedKey(appleInput('iPhone 16 128GB', { sourceContext: otherContext })),
    );
  });

  it('preserves resolved discriminants and condition conservatively', () => {
    const keys = [
      resolvedKey(appleInput('iPhone 16 128GB')),
      resolvedKey(appleInput('iPhone 16 256GB')),
      resolvedKey(appleInput('iPhone 16 Pro 256GB')),
      resolvedKey(appleInput('iPhone 16 Pro Max 256GB')),
      resolvedKey(appleInput('iPhone 16 128GB', { quality: 'CPO' })),
      resolvedKey(appleInput('iPhone 16 128GB', { quality: 'SEMINOVO' })),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps screen, connectivity, configuration, family, and quantity distinct', () => {
    const pairs = [
      [
        appleInput('Apple Watch Series 11 46mm GPS'),
        appleInput('Apple Watch Series 11 46mm GPS + Cellular'),
      ],
      [appleInput('Apple Watch Series 11 46mm GPS'), appleInput('Apple Watch Ultra 2 49mm GPS')],
      [appleInput('AirPods 4 Regular'), appleInput('AirPods Max USB-C')],
      [appleInput('MacBook Air M5 13" 16/512GB'), appleInput('MacBook Air M5 15" 16/512GB')],
      [appleInput('MacBook Air M5 13" 16/512GB'), appleInput('MacBook Air M5 13" 16/1TB')],
      [appleInput('AirTag 1 unidade'), appleInput('AirTag 4 unidades')],
    ];

    pairs.forEach(([left, right]) => {
      expect(resolvedKey(left!)).not.toBe(resolvedKey(right!));
    });
  });

  it('returns insufficient instead of emitting a partial key', () => {
    expect(deriveShippingWeightKey(appleInput('iPhone 16 Pro'))).toMatchObject({
      status: 'KEY_INSUFFICIENT',
    });
    expect(
      deriveShippingWeightKey(
        appleInput('iPhone 16 128GB', { composition: { kind: 'UNSTRUCTURED_BUNDLE' } }),
      ),
    ).toEqual({ status: 'KEY_INSUFFICIENT', missingAttributes: ['bundle_signature'] });
  });

  it('preserves Product Identity ambiguity as logistics ambiguity', () => {
    expect(
      deriveShippingWeightKey(appleInput('iPhone 16 Pro 256GB Apple Watch Series 11 46mm')),
    ).toEqual({ status: 'KEY_AMBIGUOUS', ambiguousSources: ['product_identity'] });
    expect(
      deriveShippingWeightKey({
        ...appleInput('iPhone 16 128GB'),
        manufacturer: { status: 'AMBIGUOUS' },
      }),
    ).toEqual({ status: 'KEY_AMBIGUOUS', ambiguousSources: ['manufacturer'] });
  });

  it.each([
    ['garmin', 'Garmin Vivoactive 6'],
    ['canon', 'Canon EOS Rebel T7'],
    ['samsung', 'Samsung Galaxy'],
  ])(
    'fails closed for registry-resolved Non-Apple %s without canonical logistics identity',
    (manufacturerKey, productName) => {
      const input: ShippingWeightKeyInput = {
        manufacturer: { status: 'RESOLVED', manufacturerKey },
        productIdentity: deriveExtendedProductIdentity({ productName, quality: 'NOVO' }),
        composition: { kind: 'SINGLE_ITEM' },
      };

      expect(deriveShippingWeightKey(input)).toMatchObject({ status: 'KEY_INSUFFICIENT' });
    },
  );
});
