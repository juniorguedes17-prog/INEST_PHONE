import { describe, expect, it } from 'vitest';
import { roundMoneyToCents } from '../validators/import-radar.validators';
import {
  calculateSaspyExpressCost,
  SaspyExpressCalculationError,
  type SaspyExpressCalculationErrorCode,
  type SaspyExpressCostCalculatorInput,
} from './saspy-express-cost.calculator';

const input: SaspyExpressCostCalculatorInput = {
  productPriceUsd: 1000,
  usdBrlQuote: 5.1,
  shippingWeightLbs: 2.2,
  shippingUsdPerKg: 23.5,
  freightUsdBrlQuote: 5.8,
  redirectCostBrl: 200,
  taxTreatment: 'TAXABLE',
  usTaxPercent: 7,
};

describe('calculateSaspyExpressCost', () => {
  it('converts lbs to kg and applies the editable USD/kg rate', () => {
    const result = calculateSaspyExpressCost(input);

    expect(result.breakdown.weightKg).toBeCloseTo(2.2 * 0.45359237, 12);
    expect(result.breakdown.shippingUsd).toBeCloseTo(2.2 * 0.45359237 * 23.5, 12);
  });

  it('uses the Rei TAX configuration and general USD quote without changing the freight quote', () => {
    const result = calculateSaspyExpressCost(input);

    expect(result.breakdown.usdBrlQuote).toBe(5.1);
    expect(result.breakdown.freightUsdBrlQuote).toBe(5.8);
    expect(result.breakdown.productValueBrl).toBe(5100);
    expect(result.breakdown.shippingBrl).toBe(roundMoneyToCents(2.2 * 0.45359237 * 23.5 * 5.8));
    expect(result.breakdown.redirectCostBrl).toBe(200);
    expect(result.breakdown).toMatchObject({
      taxTreatment: 'TAXABLE',
      taxPercent: 7,
      taxUsd: 70,
      taxBrl: 357,
    });
    expect(result.finalCost).toEqual({
      currency: 'BRL',
      amountBrl: roundMoneyToCents(
        result.breakdown.productValueBrl +
          result.breakdown.shippingBrl +
          result.breakdown.redirectCostBrl +
          result.breakdown.taxBrl,
      ),
    });
  });

  it('keeps TAX at zero and outside FinalCost for an EXEMPT retailer', () => {
    const taxable = calculateSaspyExpressCost(input);
    const exempt = calculateSaspyExpressCost({ ...input, taxTreatment: 'EXEMPT' });

    expect(exempt.breakdown).toMatchObject({ taxPercent: 7, taxUsd: 0, taxBrl: 0 });
    expect(exempt.finalCost.amountBrl).toBe(
      roundMoneyToCents(
        exempt.breakdown.productValueBrl +
          exempt.breakdown.shippingBrl +
          exempt.breakdown.redirectCostBrl,
      ),
    );
    expect(taxable.finalCost.amountBrl - exempt.finalCost.amountBrl).toBe(taxable.breakdown.taxBrl);
  });

  it('rounds each BRL component and FinalCost safely to cents', () => {
    const result = calculateSaspyExpressCost({
      ...input,
      productPriceUsd: 10.123,
      shippingWeightLbs: 1.234,
      redirectCostBrl: 25.555,
    });

    expect(roundMoneyToCents(result.breakdown.productValueBrl)).toBe(
      result.breakdown.productValueBrl,
    );
    expect(roundMoneyToCents(result.breakdown.shippingBrl)).toBe(result.breakdown.shippingBrl);
    expect(result.breakdown.redirectCostBrl).toBe(25.56);
    expect(roundMoneyToCents(result.finalCost.amountBrl)).toBe(result.finalCost.amountBrl);
  });

  it.each([null, undefined])('does not fall back when the freight quote is %s', (quote) => {
    expectSaspyError(
      () => calculateSaspyExpressCost({ ...input, freightUsdBrlQuote: quote }),
      'FREIGHT_USD_BRL_QUOTE_NOT_CONFIGURED',
    );
  });

  it.each([
    ['product quote', { usdBrlQuote: 0 }, 'INVALID_USD_BRL_QUOTE'],
    ['freight quote', { freightUsdBrlQuote: Number.NaN }, 'INVALID_FREIGHT_USD_BRL_QUOTE'],
    ['missing weight', { shippingWeightLbs: null }, 'SHIPPING_WEIGHT_MISSING'],
    ['invalid weight', { shippingWeightLbs: -1 }, 'INVALID_SHIPPING_WEIGHT'],
    ['product price', { productPriceUsd: -1 }, 'INVALID_PRODUCT_PRICE'],
    ['USD/kg rate', { shippingUsdPerKg: -1 }, 'INVALID_SASPY_SHIPPING_RATE'],
    ['redirect cost', { redirectCostBrl: Number.POSITIVE_INFINITY }, 'INVALID_REDIRECT_COST'],
    ['TAX percent', { usTaxPercent: 100.01 }, 'INVALID_US_TAX_PERCENT'],
    ['TAX treatment', { taxTreatment: 'UNRESOLVED' as never }, 'UNSUPPORTED_TAX_TREATMENT'],
  ] as const)('rejects invalid %s', (_label, overrides, code) => {
    expectSaspyError(() => calculateSaspyExpressCost({ ...input, ...overrides }), code);
  });
});

function expectSaspyError(run: () => unknown, code: SaspyExpressCalculationErrorCode) {
  try {
    run();
    throw new Error('Expected SaspyExpressCalculationError');
  } catch (error) {
    expect(error).toBeInstanceOf(SaspyExpressCalculationError);
    expect((error as SaspyExpressCalculationError).code).toBe(code);
  }
}
