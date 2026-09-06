import { describe, expect, it } from 'vitest';
import {
  resolveUsaRetailerTaxTreatment,
  type UsaRetailerEvidence,
} from './usa-retailer-tax-treatment';

function trustedStore(retailer: string): UsaRetailerEvidence {
  return { retailer, provenance: 'SOURCE_STORE', isTrustedRetailer: true };
}

function resolve(
  redirector: 'RED_DELAWARE' | 'REI_DO_IMPORTADO',
  retailerEvidence: readonly UsaRetailerEvidence[],
) {
  return resolveUsaRetailerTaxTreatment({ redirector, retailerEvidence });
}

describe('resolveUsaRetailerTaxTreatment', () => {
  it.each([
    ['Amazon', 'amazon', 'Amazon'],
    ['eBay', 'ebay', 'eBay'],
    ['Walmart', 'walmart', 'Walmart'],
    ['BEST-BUY', 'best-buy', 'Best Buy'],
    ['B & H Photo', 'bh-photo-video', 'B&H Photo Video'],
    ['Adorama', 'adorama', 'Adorama'],
  ])(
    'keeps Rei whitelist retailer %s exempt through explicit safe normalization',
    (retailer, key, name) => {
      expect(resolve('REI_DO_IMPORTADO', [trustedStore(retailer)])).toEqual({
        taxTreatment: 'EXEMPT',
        retailer: { retailerKey: key, canonicalName: name },
        provenance: ['SOURCE_STORE'],
      });
    },
  );

  it.each(['Amazon', 'Best Buy', 'B&H Photo Video', 'Adorama'])(
    'exempts %s through Red Delaware without changing its retailer identity',
    (retailer) => {
      expect(resolve('RED_DELAWARE', [trustedStore(retailer)])).toMatchObject({
        taxTreatment: 'EXEMPT',
      });
    },
  );

  it.each(['Apple Store USA', 'Apple Store', 'Apple US Store'])(
    'makes Apple Store USA alias %s TAXABLE only for Rei do Importado',
    (retailer) => {
      expect(resolve('REI_DO_IMPORTADO', [trustedStore(retailer)])).toEqual({
        taxTreatment: 'TAXABLE',
        retailer: { retailerKey: 'apple-store-usa', canonicalName: 'Apple Store USA' },
        provenance: ['SOURCE_STORE'],
      });
      expect(resolve('RED_DELAWARE', [trustedStore(retailer)])).toMatchObject({
        taxTreatment: 'EXEMPT',
      });
    },
  );

  it('uses the redirector rule for a trusted retailer outside the Rei whitelist', () => {
    expect(resolve('RED_DELAWARE', [trustedStore('Newegg')])).toMatchObject({
      taxTreatment: 'EXEMPT',
      retailer: { retailerKey: 'newegg' },
    });
    expect(resolve('REI_DO_IMPORTADO', [trustedStore('Newegg')])).toMatchObject({
      taxTreatment: 'TAXABLE',
      retailer: { retailerKey: 'newegg' },
    });
  });

  it.each([
    ['RED_DELAWARE', []],
    ['REI_DO_IMPORTADO', []],
    ['RED_DELAWARE', [{ retailer: null, provenance: 'SOURCE_STORE', isTrustedRetailer: true }]],
    [
      'REI_DO_IMPORTADO',
      [{ retailer: 'Marketplace', provenance: 'SOURCE_STORE', isTrustedRetailer: false }],
    ],
  ] as const)(
    'fails closed for missing or untrusted retailer evidence',
    (redirector, retailerEvidence) => {
      const result = resolve(redirector, retailerEvidence);

      expect(result.taxTreatment).toBe('UNRESOLVED');
    },
  );

  it('fails closed when trusted retailer evidence conflicts for either redirector', () => {
    for (const redirector of ['RED_DELAWARE', 'REI_DO_IMPORTADO'] as const) {
      expect(
        resolve(redirector, [
          trustedStore('Amazon'),
          { retailer: 'Walmart', provenance: 'EXPLICIT_RETAILER', isTrustedRetailer: true },
        ]),
      ).toEqual({
        taxTreatment: 'UNRESOLVED',
        reason: 'RETAILER_CONFLICT',
        provenance: ['SOURCE_STORE', 'EXPLICIT_RETAILER'],
      });
    }
  });

  it('accepts matching trusted evidence without first-match routing', () => {
    expect(
      resolve('REI_DO_IMPORTADO', [
        trustedStore('Best Buy'),
        { retailer: 'best-buy', provenance: 'EXPLICIT_RETAILER', isTrustedRetailer: true },
      ]),
    ).toEqual({
      taxTreatment: 'EXEMPT',
      retailer: { retailerKey: 'best-buy', canonicalName: 'Best Buy' },
      provenance: ['SOURCE_STORE', 'EXPLICIT_RETAILER'],
    });
  });

  it('keeps manufacturer independent from redirector-and-retailer TAX treatment', () => {
    expect(
      resolveUsaRetailerTaxTreatment({
        redirector: 'REI_DO_IMPORTADO',
        manufacturerKey: 'apple',
        retailerEvidence: [trustedStore('Best Buy')],
      }),
    ).toMatchObject({ taxTreatment: 'EXEMPT', retailer: { retailerKey: 'best-buy' } });
    expect(
      resolveUsaRetailerTaxTreatment({
        redirector: 'REI_DO_IMPORTADO',
        manufacturerKey: 'apple',
        retailerEvidence: [trustedStore('Apple Store USA')],
      }),
    ).toMatchObject({ taxTreatment: 'TAXABLE', retailer: { retailerKey: 'apple-store-usa' } });
    expect(
      resolveUsaRetailerTaxTreatment({ redirector: 'RED_DELAWARE', manufacturerKey: 'apple' }),
    ).toMatchObject({
      taxTreatment: 'UNRESOLVED',
      reason: 'RETAILER_MISSING',
    });
    expect(
      resolveUsaRetailerTaxTreatment({
        redirector: 'RED_DELAWARE',
        manufacturerKey: 'canon',
        retailerEvidence: [trustedStore('Apple Store USA')],
      }),
    ).toMatchObject({ taxTreatment: 'EXEMPT', retailer: { retailerKey: 'apple-store-usa' } });
  });

  it('does not accept logistics, financial classification, product text, or shipping weight as authorities', () => {
    expect(resolveUsaRetailerTaxTreatment({ redirector: 'REI_DO_IMPORTADO' })).toEqual({
      taxTreatment: 'UNRESOLVED',
      reason: 'RETAILER_MISSING',
      provenance: [],
    });
  });
});
