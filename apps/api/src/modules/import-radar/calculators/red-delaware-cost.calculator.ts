import type { FinalCost, RedirectorShippingMode } from '../usa-cost.contract';
import { roundMoneyToCents } from '../validators/import-radar.validators';

export type RedDelawareCalculationErrorCode =
  | 'USD_BRL_QUOTE_NOT_CONFIGURED'
  | 'INVALID_USD_BRL_QUOTE'
  | 'SHIPPING_WEIGHT_MISSING'
  | 'INVALID_SHIPPING_WEIGHT'
  | 'INVALID_PRODUCT_PRICE'
  | 'INVALID_RED_DELAWARE_RATE'
  | 'UNSUPPORTED_SHIPPING_MODE';

/** Deterministic, pure error intended for the future USA orchestration layer. */
export class RedDelawareCalculationError extends Error {
  constructor(readonly code: RedDelawareCalculationErrorCode) {
    super(code);
    this.name = 'RedDelawareCalculationError';
  }
}

export interface RedDelawareCostCalculatorInput {
  productPriceUsd: number;
  /** null/undefined is an explicit non-configured USA quote, never zero. */
  usdBrlQuote: number | null | undefined;
  /** The P2 record value; it is never rounded or persisted by this calculator. */
  shippingWeightLbs: number | null | undefined;
  firstLbUsd: number;
  additionalLbUsd: number;
  shippingMode: RedirectorShippingMode;
}

export interface RedDelawareCostBreakdown {
  productPriceUsd: number;
  usdBrlQuote: number;
  shippingWeightLbs: number;
  chargedLbs: number;
  firstLbUsd: number;
  additionalLbUsd: number;
  shippingUsd: number;
  productValueBrl: number;
  shippingBrl: number;
}

export interface RedDelawareCostCalculation {
  redirector: 'RED_DELAWARE';
  shippingMode: 'EXPRESS';
  breakdown: RedDelawareCostBreakdown;
  finalCost: FinalCost;
}

/**
 * Computes only the homologated Red Delaware EXPRESS origin cost. It does not
 * price, persist, resolve weights, fetch settings, or apply TAX/insurance.
 */
export function calculateRedDelawareExpressCost(
  input: RedDelawareCostCalculatorInput,
): RedDelawareCostCalculation {
  assertShippingMode(input.shippingMode);
  const usdBrlQuote = assertUsdBrlQuote(input.usdBrlQuote);
  const shippingWeightLbs = assertShippingWeight(input.shippingWeightLbs);
  assertNonNegativeFinite(input.productPriceUsd, 'INVALID_PRODUCT_PRICE');
  assertNonNegativeFinite(input.firstLbUsd, 'INVALID_RED_DELAWARE_RATE');
  assertNonNegativeFinite(input.additionalLbUsd, 'INVALID_RED_DELAWARE_RATE');

  const chargedLbs = Math.ceil(shippingWeightLbs);
  const shippingUsd = input.firstLbUsd + Math.max(chargedLbs - 1, 0) * input.additionalLbUsd;
  const productValueBrl = roundMoneyToCents(input.productPriceUsd * usdBrlQuote);
  const shippingBrl = roundMoneyToCents(shippingUsd * usdBrlQuote);
  const finalCost: FinalCost = {
    currency: 'BRL',
    amountBrl: roundMoneyToCents(productValueBrl + shippingBrl),
  };

  return {
    redirector: 'RED_DELAWARE',
    shippingMode: 'EXPRESS',
    breakdown: {
      productPriceUsd: input.productPriceUsd,
      usdBrlQuote,
      shippingWeightLbs,
      chargedLbs,
      firstLbUsd: input.firstLbUsd,
      additionalLbUsd: input.additionalLbUsd,
      shippingUsd,
      productValueBrl,
      shippingBrl,
    },
    finalCost,
  };
}

function assertShippingMode(mode: RedirectorShippingMode) {
  if (mode !== 'EXPRESS') {
    throw new RedDelawareCalculationError('UNSUPPORTED_SHIPPING_MODE');
  }
}

function assertUsdBrlQuote(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new RedDelawareCalculationError('USD_BRL_QUOTE_NOT_CONFIGURED');
  }
  assertNonNegativeFinite(value, 'INVALID_USD_BRL_QUOTE');
  if (value === 0) {
    throw new RedDelawareCalculationError('INVALID_USD_BRL_QUOTE');
  }
  return value;
}

function assertShippingWeight(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new RedDelawareCalculationError('SHIPPING_WEIGHT_MISSING');
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new RedDelawareCalculationError('INVALID_SHIPPING_WEIGHT');
  }
  return value;
}

function assertNonNegativeFinite(value: number, code: RedDelawareCalculationErrorCode) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RedDelawareCalculationError(code);
  }
}
