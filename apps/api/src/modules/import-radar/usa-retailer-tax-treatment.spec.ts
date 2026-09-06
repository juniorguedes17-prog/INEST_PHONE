import { describe, expect, it } from 'vitest';
import {
  resolveUsaRetailerTaxTreatment,
  type UsaRetailerEvidence,
} from './usa-retailer-tax-treatment';

function trustedStore(retailer: string): UsaRetailerEvidence {
  return { retailer, provenance: 'SOURCE_STORE', isTrustedRetailer: true };
}

describe('resolveUsaRetailerTaxTreatment', () => {
  it.each([
    ['Amazon', 'amazon', 'Amazon'],
    ['eBay', 'ebay', 'eBay'],
    ['Walmart', 'walmart', 'Walmart'],
    ['BEST-BUY', 'best-buy', 'Best Buy'],
    ['B & H Photo', 'bh-photo-video', 'B&H Photo Video'],
    ['Adorama', 'adorama', 'Adorama'],
  ])('recognizes exempt retailer %s through explicit safe normalization', (retailer, key, name) => {
    expect(resolveUsaRetailerTaxTreatment({ retailerEvidence: [trustedStore(retailer)] })).toEqual({
      taxTreatment: 'EXEMPT',
      retailer: { retailerKey: key, canonicalName: name },
      provenance: ['SOURCE_STORE'],
    });
  });

  it('returns TAXABLE only for a trusted, normalized retailer outside the exempt list', () => {
    expect(resolveUsaRetailerTaxTreatment({ retailerEvidence: [trustedStore('Target')] })).toEqual({
      taxTreatment: 'TAXABLE',
      retailer: { retailerKey: 'target', canonicalName: 'Target' },
      provenance: ['SOURCE_STORE'],
    });
  });

  it.each([
    [[]],
    [[{ retailer: null, provenance: 'SOURCE_STORE', isTrustedRetailer: true }]],
    [[{ retailer: 'Marketplace', provenance: 'SOURCE_STORE', isTrustedRetailer: false }]],
  ] as const)('fails closed for missing or untrusted retailer evidence', (retailerEvidence) => {
    const result = resolveUsaRetailerTaxTreatment({ retailerEvidence });

    expect(result.taxTreatment).toBe('UNRESOLVED');
  });

  it('keeps manufacturer independent from retailer TAX treatment', () => {
    expect(
      resolveUsaRetailerTaxTreatment({
        manufacturerKey: 'apple',
        retailerEvidence: [trustedStore('Best Buy')],
      }),
    ).toMatchObject({ taxTreatment: 'EXEMPT', retailer: { retailerKey: 'best-buy' } });
    expect(resolveUsaRetailerTaxTreatment({ manufacturerKey: 'canon' })).toMatchObject({
      taxTreatment: 'UNRESOLVED',
      reason: 'RETAILER_MISSING',
    });
  });

  it('fails closed when trusted retailer evidence conflicts', () => {
    expect(
      resolveUsaRetailerTaxTreatment({
        retailerEvidence: [
          trustedStore('Amazon'),
          { retailer: 'Walmart', provenance: 'EXPLICIT_RETAILER', isTrustedRetailer: true },
        ],
      }),
    ).toEqual({
      taxTreatment: 'UNRESOLVED',
      reason: 'RETAILER_CONFLICT',
      provenance: ['SOURCE_STORE', 'EXPLICIT_RETAILER'],
    });
  });

  it('accepts matching trusted evidence without first-match routing', () => {
    expect(
      resolveUsaRetailerTaxTreatment({
        retailerEvidence: [
          trustedStore('Best Buy'),
          { retailer: 'best-buy', provenance: 'EXPLICIT_RETAILER', isTrustedRetailer: true },
        ],
      }),
    ).toEqual({
      taxTreatment: 'EXEMPT',
      retailer: { retailerKey: 'best-buy', canonicalName: 'Best Buy' },
      provenance: ['SOURCE_STORE', 'EXPLICIT_RETAILER'],
    });
  });

  it('does not accept logistics, financial classification, product text, or shipping weight as authorities', () => {
    expect(resolveUsaRetailerTaxTreatment({})).toEqual({
      taxTreatment: 'UNRESOLVED',
      reason: 'RETAILER_MISSING',
      provenance: [],
    });
  });
});
