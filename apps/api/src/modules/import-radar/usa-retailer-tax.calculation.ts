import { roundMoneyToCents } from './validators/import-radar.validators';
import type { UsaTaxTreatment } from './usa-retailer-tax-treatment';

export type ResolvedUsaTaxTreatment = Exclude<UsaTaxTreatment, 'UNRESOLVED'>;

/**
 * Shared monetary leg of the USA retailer TAX policy. Retailer resolution and
 * input validation remain the responsibility of the caller.
 */
export function calculateUsaRetailerTax(input: {
  productPriceUsd: number;
  taxTreatment: ResolvedUsaTaxTreatment;
  usTaxPercent: number;
  usdBrlQuote: number;
}) {
  const taxUsd =
    input.taxTreatment === 'TAXABLE'
      ? (input.productPriceUsd * input.usTaxPercent) / 100
      : 0;

  return {
    taxUsd,
    taxBrl: roundMoneyToCents(taxUsd * input.usdBrlQuote),
  };
}
