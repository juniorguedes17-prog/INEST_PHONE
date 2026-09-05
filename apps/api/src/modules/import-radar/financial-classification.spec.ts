import { describe, expect, it } from 'vitest';
import { resolveFinancialClassification } from './financial-classification';

describe('resolveFinancialClassification', () => {
  const source = {
    productName: 'Camera Digital Canon EOS Rebel T7 24.1MP',
    category: 'Outros',
  };

  it('keeps a known canonical Product as the highest authority', () => {
    expect(
      resolveFinancialClassification({ ...source, canonicalProduct: { isAppleOriginal: true } }),
    ).toMatchObject({ classification: 'APPLE', reason: 'canonical_product' });
    expect(
      resolveFinancialClassification({ ...source, canonicalProduct: { isAppleOriginal: false } }),
    ).toMatchObject({ classification: 'NON_APPLE', reason: 'canonical_product' });
  });

  it('uses a deterministic Apple registry match without a Product', () => {
    expect(
      resolveFinancialClassification({
        productName: 'MacBook Air M5 13 16GB 512GB',
        condition: 'NOVO',
      }),
    ).toMatchObject({ classification: 'APPLE', reason: 'apple_registry' });
  });

  it('accepts only explicit source manufacturer evidence for third-party routing', () => {
    expect(
      resolveFinancialClassification({
        ...source,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      }),
    ).toMatchObject({ classification: 'NON_APPLE', reason: 'source_manufacturer' });
    expect(
      resolveFinancialClassification({ ...source, sourceManufacturer: 'Canon' }),
    ).toMatchObject({ classification: 'UNRESOLVED' });
  });

  it('fails closed for inferred text and conflicting evidence', () => {
    expect(
      resolveFinancialClassification({ ...source, productName: 'Canon EOS Rebel T7' }),
    ).toMatchObject({
      classification: 'UNRESOLVED',
    });
    expect(
      resolveFinancialClassification({
        productName: 'MacBook Air M5 13 16GB 512GB',
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'classification_conflict' });
  });
});
