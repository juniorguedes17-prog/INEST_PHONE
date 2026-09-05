import type { SourceCommercialIdentity } from './interfaces/source-commercial-identity.interface';

/** Identifies the future USA origin-cost strategy without carrying its rates. */
export type UsaRedirector = 'RED_DELAWARE' | 'REI_DO_IMPORTADO';

/** Red Delaware is the only redirector with a homologated shipping mode in P1. */
export type RedirectorShippingMode = 'EXPRESS';

/**
 * A redirector selection is discriminated so Rei do Importado cannot receive a
 * fictional shipping mode before its domain rules are introduced.
 */
export type UsaRedirectorSelection =
  | {
      redirector: 'RED_DELAWARE';
      shippingMode: RedirectorShippingMode;
    }
  | {
      redirector: 'REI_DO_IMPORTADO';
    };

/**
 * Acquisition cost emitted by an external radar after every origin-specific
 * cost has been resolved. Pricing consumes this value; it does not derive it.
 */
export interface FinalCost {
  currency: 'BRL';
  amountBrl: number;
}

/**
 * The breakdown belongs to the selected strategy. P1 intentionally leaves its
 * shape open so Red Delaware and Rei do Importado remain independent.
 */
export interface UsaCostCalculationResultInput<TBreakdown extends object> {
  sourceCommercialIdentity: SourceCommercialIdentity<'US'>;
  redirector: UsaRedirectorSelection;
  productPriceUsd: number;
  finalCost: FinalCost;
  breakdown: TBreakdown;
}

/**
 * Future USA origin-cost result. sourceProductId is projected from the shared
 * commercial identity so callers do not create an independent USA identity.
 */
export interface UsaCostCalculationResult<
  TBreakdown extends object,
> extends UsaCostCalculationResultInput<TBreakdown> {
  sourceProductId: string;
}

/**
 * Pure projection only: no rate, conversion, freight, TAX, insurance, or
 * redirector formula is applied in this foundation contract.
 */
export function createUsaCostCalculationResult<TBreakdown extends object>(
  input: UsaCostCalculationResultInput<TBreakdown>,
): UsaCostCalculationResult<TBreakdown> {
  return {
    ...input,
    sourceProductId: input.sourceCommercialIdentity.sourceProductId,
  };
}
