import type { FinalCost } from '../usa-cost.contract';
import { roundMoneyToCents } from '../validators/import-radar.validators';

const LBS_TO_KG = 0.45359237;

export type SaspyExpressCalculationErrorCode =
  | 'USD_BRL_QUOTE_NOT_CONFIGURED'
  | 'INVALID_USD_BRL_QUOTE'
  | 'FREIGHT_USD_BRL_QUOTE_NOT_CONFIGURED'
  | 'INVALID_FREIGHT_USD_BRL_QUOTE'
  | 'SHIPPING_WEIGHT_MISSING'
  | 'INVALID_SHIPPING_WEIGHT'
  | 'INVALID_PRODUCT_PRICE'
  | 'INVALID_SASPY_SHIPPING_RATE'
  | 'INVALID_REDIRECT_COST';

export class SaspyExpressCalculationError extends Error {
  constructor(readonly code: SaspyExpressCalculationErrorCode) {
    super(code);
    this.name = 'SaspyExpressCalculationError';
  }
}

export interface SaspyExpressCostCalculatorInput {
  productPriceUsd: number;
  /** Product conversion authority from usaImport.usdBrlQuote. */
  usdBrlQuote: number | null | undefined;
  /** Existing ShippingWeightRecord value; conversion happens only in this calculator. */
  shippingWeightLbs: number | null | undefined;
  shippingUsdPerKg: number;
  /** Saspy freight-only conversion authority; it never falls back to usdBrlQuote. */
  freightUsdBrlQuote: number | null | undefined;
  /** BRL value resolved from the existing ImportRedirectRule source. */
  redirectCostBrl: number;
}

export interface SaspyExpressCostBreakdown {
  productPriceUsd: number;
  usdBrlQuote: number;
  shippingWeightLbs: number;
  weightKg: number;
  shippingUsdPerKg: number;
  shippingUsd: number;
  freightUsdBrlQuote: number;
  productValueBrl: number;
  shippingBrl: number;
  redirectCostBrl: number;
}

export interface SaspyExpressCostCalculation {
  redirector: 'SASPY_EXPRESS';
  breakdown: SaspyExpressCostBreakdown;
  finalCost: FinalCost;
}

/** Pure Saspy composition. It does not resolve settings, weight, rules, Pricing, or Offers. */
export function calculateSaspyExpressCost(
  input: SaspyExpressCostCalculatorInput,
): SaspyExpressCostCalculation {
  const usdBrlQuote = assertPositiveQuote(
    input.usdBrlQuote,
    'USD_BRL_QUOTE_NOT_CONFIGURED',
    'INVALID_USD_BRL_QUOTE',
  );
  const freightUsdBrlQuote = assertPositiveQuote(
    input.freightUsdBrlQuote,
    'FREIGHT_USD_BRL_QUOTE_NOT_CONFIGURED',
    'INVALID_FREIGHT_USD_BRL_QUOTE',
  );
  const shippingWeightLbs = assertShippingWeight(input.shippingWeightLbs);
  assertNonNegativeFinite(input.productPriceUsd, 'INVALID_PRODUCT_PRICE');
  assertNonNegativeFinite(input.shippingUsdPerKg, 'INVALID_SASPY_SHIPPING_RATE');
  assertNonNegativeFinite(input.redirectCostBrl, 'INVALID_REDIRECT_COST');

  const weightKg = shippingWeightLbs * LBS_TO_KG;
  const shippingUsd = weightKg * input.shippingUsdPerKg;
  const productValueBrl = roundMoneyToCents(input.productPriceUsd * usdBrlQuote);
  const shippingBrl = roundMoneyToCents(shippingUsd * freightUsdBrlQuote);
  const redirectCostBrl = roundMoneyToCents(input.redirectCostBrl);
  const finalCost: FinalCost = {
    currency: 'BRL',
    amountBrl: roundMoneyToCents(productValueBrl + shippingBrl + redirectCostBrl),
  };

  return {
    redirector: 'SASPY_EXPRESS',
    breakdown: {
      productPriceUsd: input.productPriceUsd,
      usdBrlQuote,
      shippingWeightLbs,
      weightKg,
      shippingUsdPerKg: input.shippingUsdPerKg,
      shippingUsd,
      freightUsdBrlQuote,
      productValueBrl,
      shippingBrl,
      redirectCostBrl,
    },
    finalCost,
  };
}

function assertPositiveQuote(
  value: number | null | undefined,
  missingCode: SaspyExpressCalculationErrorCode,
  invalidCode: SaspyExpressCalculationErrorCode,
): number {
  if (value === null || value === undefined) {
    throw new SaspyExpressCalculationError(missingCode);
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new SaspyExpressCalculationError(invalidCode);
  }
  return value;
}

function assertShippingWeight(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new SaspyExpressCalculationError('SHIPPING_WEIGHT_MISSING');
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new SaspyExpressCalculationError('INVALID_SHIPPING_WEIGHT');
  }
  return value;
}

function assertNonNegativeFinite(value: number, code: SaspyExpressCalculationErrorCode) {
  if (!Number.isFinite(value) || value < 0) {
    throw new SaspyExpressCalculationError(code);
  }
}
