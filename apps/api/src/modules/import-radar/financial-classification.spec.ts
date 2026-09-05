import { describe, expect, it } from 'vitest';
import { resolveFinancialClassification } from './financial-classification';

describe('resolveFinancialClassification', () => {
  const source = {
    productName: 'Camera Digital Canon EOS Rebel T7 24.1MP',
    category: 'Outros',
  };

  const canon = {
    status: 'FOUND' as const,
    manufacturerId: 'manufacturer-canon',
    manufacturerKey: 'canon',
    canonicalName: 'Canon',
    provenance: 'EXPLICIT_SOURCE_VALIDATED' as const,
    normalizedEvidence: 'canon',
    matchedAlias: 'Canon',
    normalizedAlias: 'canon',
  };

  it('keeps a known canonical Product as the highest authority', () => {
    expect(
      resolveFinancialClassification({
        ...source,
        canonicalProduct: { isAppleOriginal: true },
        manufacturerResolution: canon,
      }),
    ).toMatchObject({
      classification: 'APPLE',
      reason: 'canonical_product',
      provenance: 'CANONICAL_PRODUCT',
    });
    expect(
      resolveFinancialClassification({
        productName: 'MacBook Air M5 13 16GB 512GB',
        canonicalProduct: { isAppleOriginal: false },
        manufacturerResolution: canon,
      }),
    ).toMatchObject({
      classification: 'NON_APPLE',
      reason: 'canonical_product',
      provenance: 'CANONICAL_PRODUCT',
    });
    expect(
      resolveFinancialClassification({
        ...source,
        canonicalProduct: { isAppleOriginal: false },
        manufacturerResolution: canon,
      }),
    ).toMatchObject({
      classification: 'NON_APPLE',
      reason: 'canonical_product',
      provenance: 'CANONICAL_PRODUCT',
    });
  });

  it('uses a deterministic Apple registry match without a Product', () => {
    expect(
      resolveFinancialClassification({
        productName: 'MacBook Air M5 13 16GB 512GB',
        condition: 'NOVO',
      }),
    ).toMatchObject({ classification: 'APPLE', reason: 'apple_registry' });
  });

  it('accepts only a registry-resolved explicit source manufacturer for third-party routing', () => {
    expect(
      resolveFinancialClassification({
        ...source,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        manufacturerResolution: canon,
      }),
    ).toMatchObject({
      classification: 'NON_APPLE',
      reason: 'manufacturer_registry',
      manufacturerKey: 'canon',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
    });
    expect(
      resolveFinancialClassification({
        ...source,
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        manufacturerResolution: { status: 'MISSING', normalizedEvidence: 'canon' },
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_missing' });
  });

  it('fails closed for inferred brand, ambiguous aliases and conflicting evidence', () => {
    expect(
      resolveFinancialClassification({ ...source, productName: 'Canon EOS Rebel T7' }),
    ).toMatchObject({
      classification: 'UNRESOLVED',
    });
    expect(
      resolveFinancialClassification({
        productName: 'MacBook Air M5 13 16GB 512GB',
        manufacturerResolution: canon,
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_conflict' });
    expect(
      resolveFinancialClassification({
        ...source,
        manufacturerResolution: {
          status: 'AMBIGUOUS',
          normalizedEvidence: 'canon',
          manufacturerKeys: ['canon-a', 'canon-b'],
        },
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_ambiguous' });
  });
});
