import { describe, expect, it } from 'vitest';
import { roundMoneyToCents } from '../validators/import-radar.validators';
import {
  calculateRedDelawareExpressCost,
  RedDelawareCalculationError,
  type RedDelawareCostCalculatorInput,
} from './red-delaware-cost.calculator';

const configuredRates = {
  firstLbUsd: 27.89,
  additionalLbUsd: 11.5,
} as const;

function input(
  overrides: Partial<RedDelawareCostCalculatorInput> = {},
): RedDelawareCostCalculatorInput {
  return {
    productPriceUsd: 100,
    usdBrlQuote: 5.35,
    shippingWeightLbs: 1,
    shippingMode: 'EXPRESS',
    ...configuredRates,
    ...overrides,
  };
}

function expectCalculationError(
  overrides: Partial<RedDelawareCostCalculatorInput>,
  code: RedDelawareCalculationError['code'],
) {
  expect(() => calculateRedDelawareExpressCost(input(overrides))).toThrow(
    expect.objectContaining({ code }),
  );
}

describe('calculateRedDelawareExpressCost', () => {
  it.each([
    [0.5, 1, 27.89],
    [0.65, 1, 27.89],
    [1, 1, 27.89],
    [1.001, 2, 39.39],
    [2, 2, 39.39],
    [3.95, 4, 62.39],
    [4, 4, 62.39],
  ])(
    'charges %s lb as %s lb and produces US$ %s EXPRESS freight',
    (shippingWeightLbs, chargedLbs, shippingUsd) => {
      const result = calculateRedDelawareExpressCost(input({ shippingWeightLbs }));

      expect(result.breakdown.shippingWeightLbs).toBe(shippingWeightLbs);
      expect(result.breakdown.chargedLbs).toBe(chargedLbs);
      expect(result.breakdown.shippingUsd).toBe(shippingUsd);
    },
  );

  it('uses configured rates instead of calculator defaults', () => {
    const result = calculateRedDelawareExpressCost(
      input({ shippingWeightLbs: 3.95, firstLbUsd: 20, additionalLbUsd: 7.25 }),
    );

    expect(result.breakdown).toMatchObject({
      firstLbUsd: 20,
      additionalLbUsd: 7.25,
      chargedLbs: 4,
      shippingUsd: 41.75,
    });
  });

  it('returns the P1 FinalCost in BRL and does not add unhomologated costs', () => {
    const result = calculateRedDelawareExpressCost(input({ shippingWeightLbs: 2 }));

    expect(result).toMatchObject({
      redirector: 'RED_DELAWARE',
      shippingMode: 'EXPRESS',
      finalCost: { currency: 'BRL', amountBrl: 745.74 },
      breakdown: {
        productPriceUsd: 100,
        usdBrlQuote: 5.35,
        shippingUsd: 39.39,
        productValueBrl: 535,
        shippingBrl: 210.74,
      },
    });
    expect(result.breakdown).not.toHaveProperty('taxBrl');
    expect(result.breakdown).not.toHaveProperty('insuranceBrl');
    expect(result.breakdown).not.toHaveProperty('weightKg');
  });

  it('keeps every BRL component and FinalCost cent-safe despite decimal artifacts', () => {
    const result = calculateRedDelawareExpressCost(
      input({ productPriceUsd: 19.99, shippingWeightLbs: 0.5 }),
    );

    expect(result.breakdown.productValueBrl).toBe(106.95);
    expect(result.breakdown.shippingBrl).toBe(149.21);
    expect(result.finalCost.amountBrl).toBe(256.16);
    expect(roundMoneyToCents(result.breakdown.productValueBrl + result.breakdown.shippingBrl)).toBe(
      result.finalCost.amountBrl,
    );
    expect(roundMoneyToCents(result.breakdown.productValueBrl)).toBe(
      result.breakdown.productValueBrl,
    );
    expect(roundMoneyToCents(result.breakdown.shippingBrl)).toBe(result.breakdown.shippingBrl);
    expect(roundMoneyToCents(result.finalCost.amountBrl)).toBe(result.finalCost.amountBrl);
  });

  it('does not calculate when the USA quote is not configured', () => {
    expectCalculationError({ usdBrlQuote: null }, 'USD_BRL_QUOTE_NOT_CONFIGURED');
    expectCalculationError({ usdBrlQuote: undefined }, 'USD_BRL_QUOTE_NOT_CONFIGURED');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid USD/BRL quote %s',
    (usdBrlQuote) => {
      expectCalculationError({ usdBrlQuote }, 'INVALID_USD_BRL_QUOTE');
    },
  );

  it('does not calculate when shipping weight is absent', () => {
    expectCalculationError({ shippingWeightLbs: null }, 'SHIPPING_WEIGHT_MISSING');
    expectCalculationError({ shippingWeightLbs: undefined }, 'SHIPPING_WEIGHT_MISSING');
  });

  it.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid shipping weight %s',
    (shippingWeightLbs) => {
      expectCalculationError({ shippingWeightLbs }, 'INVALID_SHIPPING_WEIGHT');
    },
  );

  it.each<[string, Partial<RedDelawareCostCalculatorInput>, RedDelawareCalculationError['code']]>([
    ['first pound', { firstLbUsd: -0.01 }, 'INVALID_RED_DELAWARE_RATE'],
    ['additional pound', { additionalLbUsd: Number.NaN }, 'INVALID_RED_DELAWARE_RATE'],
    ['product price', { productPriceUsd: Number.POSITIVE_INFINITY }, 'INVALID_PRODUCT_PRICE'],
  ])('rejects invalid %s input', (_field, overrides, code) => {
    expectCalculationError(overrides, code);
  });

  it('fails closed for a shipping mode other than EXPRESS', () => {
    expectCalculationError({ shippingMode: 'STANDARD' as never }, 'UNSUPPORTED_SHIPPING_MODE');
  });
});
