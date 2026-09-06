import type { FinalCost } from '../usa-cost.contract';
import { roundMoneyToCents } from '../validators/import-radar.validators';

const LBS_TO_KG = 0.45359237;

export type ReiDoImportadoLogisticsClassification = 'CELULAR' | 'OTHER';
export type ReiDoImportadoTaxTreatment = 'EXEMPT' | 'TAXABLE';

export type ReiDoImportadoCalculationErrorCode =
  | 'USD_BRL_QUOTE_NOT_CONFIGURED'
  | 'INVALID_USD_BRL_QUOTE'
  | 'INVALID_PRODUCT_PRICE'
  | 'SHIPPING_WEIGHT_MISSING'
  | 'INVALID_SHIPPING_WEIGHT'
  | 'INVALID_CELLULAR_QUANTITY'
  | 'UNSUPPORTED_LOGISTICS_CLASSIFICATION'
  | 'UNSUPPORTED_TAX_TREATMENT'
  | 'INVALID_REI_DO_IMPORTADO_RATE'
  | 'INVALID_REI_DO_IMPORTADO_PERCENTAGE';

/** Deterministic, pure error intended for the future USA orchestration layer. */
export class ReiDoImportadoCalculationError extends Error {
  constructor(readonly code: ReiDoImportadoCalculationErrorCode) {
    super(code);
    this.name = 'ReiDoImportadoCalculationError';
  }
}

export interface ReiDoImportadoCostCalculatorInput {
  productPriceUsd: number;
  /** null/undefined is an explicit non-configured USA quote, never zero. */
  usdBrlQuote: number | null | undefined;
  /** Required only for OTHER; the cellular tariff is per resolved unit. */
  shippingWeightLbs: number | null | undefined;
  logisticsClassification: ReiDoImportadoLogisticsClassification;
  /** Required only for CELULAR and must be a whole number of units. */
  quantity?: number | null | undefined;
  taxTreatment: ReiDoImportadoTaxTreatment;
  phoneShippingUsd: number;
  otherProductsShippingUsdPerHalfKg: number;
  insurancePercent: number;
  usTaxPercent: number;
  airFreightDiscountPercent: number;
}

export interface ReiDoImportadoCostBreakdown {
  productPriceUsd: number;
  usdBrlQuote: number;
  shippingWeightLbs: number | null;
  classification: ReiDoImportadoLogisticsClassification;
  quantity: number | null;
  weightKg: number | null;
  halfKgBlocks: number | null;
  baseShippingUsd: number;
  shippingDiscountPercent: number;
  shippingDiscountUsd: number;
  shippingUsd: number;
  insurancePercent: number;
  insuranceBrl: number;
  taxTreatment: ReiDoImportadoTaxTreatment;
  taxPercent: number;
  taxUsd: number;
  taxBrl: number;
  productValueBrl: number;
  shippingBrl: number;
}

export interface ReiDoImportadoCostCalculation {
  redirector: 'REI_DO_IMPORTADO';
  breakdown: ReiDoImportadoCostBreakdown;
  finalCost: FinalCost;
}

/**
 * Computes only the homologated Rei do Importado origin cost. It does not
 * persist weights, resolve retailer/TAX eligibility, price, or apply any
 * origin cost outside the explicit input contract.
 */
export function calculateReiDoImportadoCost(
  input: ReiDoImportadoCostCalculatorInput,
): ReiDoImportadoCostCalculation {
  const usdBrlQuote = assertUsdBrlQuote(input.usdBrlQuote);
  assertNonNegativeFinite(input.productPriceUsd, 'INVALID_PRODUCT_PRICE');
  assertNonNegativeFinite(input.phoneShippingUsd, 'INVALID_REI_DO_IMPORTADO_RATE');
  assertNonNegativeFinite(input.otherProductsShippingUsdPerHalfKg, 'INVALID_REI_DO_IMPORTADO_RATE');
  assertPercentage(input.insurancePercent);
  assertPercentage(input.usTaxPercent);
  assertPercentage(input.airFreightDiscountPercent);
  assertClassification(input.logisticsClassification);
  assertTaxTreatment(input.taxTreatment);

  const productValueBrl = roundMoneyToCents(input.productPriceUsd * usdBrlQuote);
  const shipping = calculateShipping(input);
  const insuranceBrl = roundMoneyToCents((productValueBrl * input.insurancePercent) / 100);
  const taxUsd =
    input.taxTreatment === 'TAXABLE' ? (input.productPriceUsd * input.usTaxPercent) / 100 : 0;
  const taxBrl = roundMoneyToCents(taxUsd * usdBrlQuote);
  const shippingBrl = roundMoneyToCents(shipping.shippingUsd * usdBrlQuote);
  const finalCost: FinalCost = {
    currency: 'BRL',
    amountBrl: roundMoneyToCents(productValueBrl + shippingBrl + insuranceBrl + taxBrl),
  };

  return {
    redirector: 'REI_DO_IMPORTADO',
    breakdown: {
      productPriceUsd: input.productPriceUsd,
      usdBrlQuote,
      shippingWeightLbs: shipping.shippingWeightLbs,
      classification: input.logisticsClassification,
      quantity: shipping.quantity,
      weightKg: shipping.weightKg,
      halfKgBlocks: shipping.halfKgBlocks,
      baseShippingUsd: shipping.baseShippingUsd,
      shippingDiscountPercent: shipping.shippingDiscountPercent,
      shippingDiscountUsd: shipping.shippingDiscountUsd,
      shippingUsd: shipping.shippingUsd,
      insurancePercent: input.insurancePercent,
      insuranceBrl,
      taxTreatment: input.taxTreatment,
      taxPercent: input.usTaxPercent,
      taxUsd,
      taxBrl,
      productValueBrl,
      shippingBrl,
    },
    finalCost,
  };
}

function calculateShipping(input: ReiDoImportadoCostCalculatorInput) {
  if (input.logisticsClassification === 'CELULAR') {
    const quantity = assertCellularQuantity(input.quantity);
    const baseShippingUsd = input.phoneShippingUsd * quantity;
    const shippingDiscountUsd = (baseShippingUsd * input.airFreightDiscountPercent) / 100;

    return {
      shippingWeightLbs: input.shippingWeightLbs ?? null,
      quantity,
      weightKg: null,
      halfKgBlocks: null,
      baseShippingUsd,
      shippingDiscountPercent: input.airFreightDiscountPercent,
      shippingDiscountUsd,
      shippingUsd: baseShippingUsd - shippingDiscountUsd,
    };
  }

  const shippingWeightLbs = assertShippingWeight(input.shippingWeightLbs);
  const weightKg = shippingWeightLbs * LBS_TO_KG;
  const halfKgBlocks = Math.max(1, Math.ceil(weightKg / 0.5));
  const baseShippingUsd = halfKgBlocks * input.otherProductsShippingUsdPerHalfKg;
  const shippingDiscountUsd = (baseShippingUsd * input.airFreightDiscountPercent) / 100;

  return {
    shippingWeightLbs,
    quantity: null,
    weightKg,
    halfKgBlocks,
    baseShippingUsd,
    shippingDiscountPercent: input.airFreightDiscountPercent,
    shippingDiscountUsd,
    shippingUsd: baseShippingUsd - shippingDiscountUsd,
  };
}

function assertUsdBrlQuote(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new ReiDoImportadoCalculationError('USD_BRL_QUOTE_NOT_CONFIGURED');
  }
  assertNonNegativeFinite(value, 'INVALID_USD_BRL_QUOTE');
  if (value === 0) {
    throw new ReiDoImportadoCalculationError('INVALID_USD_BRL_QUOTE');
  }
  return value;
}

function assertClassification(value: ReiDoImportadoLogisticsClassification) {
  if (value !== 'CELULAR' && value !== 'OTHER') {
    throw new ReiDoImportadoCalculationError('UNSUPPORTED_LOGISTICS_CLASSIFICATION');
  }
}

function assertTaxTreatment(value: ReiDoImportadoTaxTreatment) {
  if (value !== 'EXEMPT' && value !== 'TAXABLE') {
    throw new ReiDoImportadoCalculationError('UNSUPPORTED_TAX_TREATMENT');
  }
}

function assertShippingWeight(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    throw new ReiDoImportadoCalculationError('SHIPPING_WEIGHT_MISSING');
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new ReiDoImportadoCalculationError('INVALID_SHIPPING_WEIGHT');
  }
  return value;
}

function assertCellularQuantity(value: number | null | undefined): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1
  ) {
    throw new ReiDoImportadoCalculationError('INVALID_CELLULAR_QUANTITY');
  }
  return value;
}

function assertPercentage(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new ReiDoImportadoCalculationError('INVALID_REI_DO_IMPORTADO_PERCENTAGE');
  }
}

function assertNonNegativeFinite(value: number, code: ReiDoImportadoCalculationErrorCode) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ReiDoImportadoCalculationError(code);
  }
}
