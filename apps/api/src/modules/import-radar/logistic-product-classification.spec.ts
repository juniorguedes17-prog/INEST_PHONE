import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { describe, expect, it } from 'vitest';
import { resolveLogisticProductClassification } from './logistic-product-classification';

function identity(productName: string) {
  return deriveExtendedProductIdentity({ productName, quality: 'NOVO' });
}

describe('resolveLogisticProductClassification', () => {
  it('classifies a canonically recognized iPhone as CELULAR', () => {
    expect(
      resolveLogisticProductClassification({ productIdentity: identity('iPhone 16 128GB') }),
    ).toEqual({ classification: 'CELULAR', sources: ['PRODUCT_IDENTITY_FAMILY'] });
  });

  it.each([
    ['MacBook Air M5 13" 16GB/512GB', 'macbook'],
    ['iPad Air M4 11" 128GB', 'ipad'],
    ['Apple Watch Series 11 42mm', 'apple-watch'],
    ['AirPods Max', 'airpods'],
  ])('classifies canonical Apple %s as OTHER', (productName, family) => {
    expect(
      resolveLogisticProductClassification({ productIdentity: identity(productName) }),
    ).toEqual({
      classification: 'OTHER',
      sources: ['PRODUCT_IDENTITY_FAMILY'],
    });
    expect(identity(productName).variant.family).toBe(family);
  });

  it.each([
    ['Canon EOS Rebel T7', 'Câmera'],
    ['Garmin Watch', 'Smartwatch'],
    ['Samsung Galaxy', 'Smartphone'],
  ])(
    'uses a trusted canonical category for %s without manufacturer rules',
    (name, canonicalCategory) => {
      const expected = canonicalCategory === 'Smartphone' ? 'CELULAR' : 'OTHER';

      expect(
        resolveLogisticProductClassification({
          manufacturerKey: name.split(' ')[0]!.toLowerCase(),
          canonicalCategory,
        }),
      ).toEqual({ classification: expected, sources: ['CANONICAL_CATEGORY'] });
    },
  );

  it('uses existing ProductType when a catalog Product is already resolved', () => {
    expect(resolveLogisticProductClassification({ productType: 'IPHONE_SEALED' })).toEqual({
      classification: 'CELULAR',
      sources: ['PRODUCT_TYPE'],
    });
    expect(resolveLogisticProductClassification({ productType: 'MACBOOK' })).toEqual({
      classification: 'OTHER',
      sources: ['PRODUCT_TYPE'],
    });
  });

  it('does not classify a manufacturer alone', () => {
    expect(resolveLogisticProductClassification({ manufacturerKey: 'samsung' })).toEqual({
      classification: 'UNRESOLVED',
      reason: 'INSUFFICIENT_EVIDENCE',
      sources: [],
    });
  });

  it.each([
    {},
    { canonicalCategory: 'Eletrônicos' },
    { canonicalCategory: 'Outros' },
    { productIdentity: identity('Produto Desconhecido') },
  ])('fails closed for absent or generic evidence', (input) => {
    expect(resolveLogisticProductClassification(input)).toEqual({
      classification: 'UNRESOLVED',
      reason: 'INSUFFICIENT_EVIDENCE',
      sources: [],
    });
  });

  it('fails closed when trusted authorities conflict', () => {
    expect(
      resolveLogisticProductClassification({
        productType: 'IPHONE_SEALED',
        canonicalCategory: 'Câmera',
      }),
    ).toEqual({
      classification: 'UNRESOLVED',
      reason: 'CONFLICTING_EVIDENCE',
      sources: ['PRODUCT_TYPE', 'CANONICAL_CATEGORY'],
    });
  });

  it('does not use product names, source IDs, retailers, or AI as input authorities', () => {
    expect(resolveLogisticProductClassification({})).toEqual({
      classification: 'UNRESOLVED',
      reason: 'INSUFFICIENT_EVIDENCE',
      sources: [],
    });
  });
});
