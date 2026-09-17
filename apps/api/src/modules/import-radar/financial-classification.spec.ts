import { describe, expect, it } from 'vitest';
import {
  resolveClassificationPricingEligibility,
  resolveFinancialClassification,
} from './financial-classification';

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
    ).toMatchObject({
      classification: 'APPLE',
      reason: 'apple_registry',
      provenance: 'APPLE_CANONICAL_REGISTRY',
    });
  });

  it('uses the canonical family authority when the generation is not cataloged', () => {
    expect(
      resolveFinancialClassification({
        productName:
          'Mac mini, M6 Chip, 12-core CPU, 12-core GPU, 24GB memory, 512GB storage',
        condition: 'NOVO',
      }),
    ).toMatchObject({
      classification: 'APPLE',
      reason: 'apple_registry',
      provenance: 'CANONICAL_FAMILY_REGISTRY',
    });
  });

  it('fails closed for conflicts involving canonical family evidence', () => {
    expect(
      resolveFinancialClassification({
        productName:
          'Mac mini, M6 Chip, 12-core CPU, 12-core GPU, 24GB memory, 512GB storage',
        canonicalProduct: { isAppleOriginal: false },
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_conflict' });
    expect(
      resolveFinancialClassification({
        productName:
          'Mac mini, M6 Chip, 12-core CPU, 12-core GPU, 24GB memory, 512GB storage',
        manufacturerResolution: canon,
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_conflict' });
    expect(
      resolveFinancialClassification({
        productName: 'Mac Mini M4 Pro 24GB 512GB iPhone 17 Pro 256GB',
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'manufacturer_conflict' });
  });

  it('does not promote an explicit source manufacturer without current registry authority', () => {
    expect(
      resolveFinancialClassification({
        productName: 'Produto XYZ Pro 512GB',
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      }),
    ).toMatchObject({ classification: 'UNRESOLVED', reason: 'classification_unresolved' });
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

  it('projects only manufacturer_missing as resolvable input', () => {
    expect(
      resolveClassificationPricingEligibility({
        classification: 'UNRESOLVED',
        reason: 'manufacturer_missing',
      }),
    ).toMatchObject({
      status: 'NEEDS_INPUT',
      reason: 'classification_unresolved',
      inputType: 'MANUFACTURER',
      diagnosticReason: 'manufacturer_missing',
    });
    expect(
      resolveClassificationPricingEligibility({
        classification: 'UNRESOLVED',
        reason: 'manufacturer_ambiguous',
      }),
    ).toMatchObject({ status: 'BLOCKED', diagnosticReason: 'manufacturer_ambiguous' });
    expect(
      resolveClassificationPricingEligibility({
        classification: 'UNRESOLVED',
        reason: 'manufacturer_conflict',
      }),
    ).toMatchObject({ status: 'BLOCKED', diagnosticReason: 'manufacturer_conflict' });
    expect(
      resolveClassificationPricingEligibility({
        classification: 'NON_APPLE',
        reason: 'canonical_product',
      }),
    ).toMatchObject({ status: 'ELIGIBLE' });
  });
});
