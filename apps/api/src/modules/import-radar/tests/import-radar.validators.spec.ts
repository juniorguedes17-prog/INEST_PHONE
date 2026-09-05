import { describe, expect, it } from 'vitest';
import {
  identifyRedirectRule,
  roundMoneyToCents,
  toNumber,
} from '../validators/import-radar.validators';

const settings = {
  dollarQuote: 5.35,
  cdeExitPerBox: 110,
  brazilDispatchPerBox: 50,
  correiosLabel: 120,
  invoiceTaxPercent: 3,
  redirectRules: [
    {
      id: 'iphone-pro-max',
      productType: 'iPhone 15 ao 17 Pro Max',
      redirectCost: 100,
      matchTerms: ['iPhone 16', 'Pro Max'],
      priority: 1,
    },
    {
      id: 'perfume',
      productType: 'Perfume',
      redirectCost: 25,
      matchTerms: ['Perfume'],
      priority: 2,
    },
  ],
};

describe('import radar validators', () => {
  it('matches redirect rules by normalized product name and priority', () => {
    const rule = identifyRedirectRule(
      {
        id: 'p1',
        name: 'Apple iPhone 16 Pro Max 256GB',
        category: 'Celulares',
        store: 'Mock',
        priceUsd: 900,
        productUrl: 'https://example.com',
      },
      settings,
    );

    expect(rule?.productType).toBe('iPhone 15 ao 17 Pro Max');
    expect(rule?.redirectCost).toBe(100);
  });

  it('returns undefined when no redirect rule matches', () => {
    const rule = identifyRedirectRule(
      {
        id: 'p2',
        name: 'Camera fotografica',
        category: 'Eletronicos',
        store: 'Mock',
        priceUsd: 300,
        productUrl: 'https://example.com',
      },
      settings,
    );

    expect(rule).toBeUndefined();
    expect(toNumber(null)).toBe(0);
  });

  it.each([
    [69.8175, 69.82],
    [1.005, 1.01],
    [2327.25, 2327.25],
  ])('rounds monetary values to cents without floating-point drift: %s', (value, expected) => {
    expect(roundMoneyToCents(value)).toBe(expected);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite monetary values: %s', (value) => {
    expect(() => roundMoneyToCents(value)).toThrow(RangeError);
  });
});
