import type { ManufacturerResolution } from '../manufacturers/manufacturer-resolver';
import type { FinalCost } from '../import-radar/usa-cost.contract';
import type { UsaSourceProduct } from '../import-radar/usa-source-product.adapter';
import type {
  FinancialClassification,
  FinancialClassificationReason,
} from '../import-radar/financial-classification';
import type { ProfitCondition } from './interfaces/profit-sheet.interface';
import type { calculateNonAppleElectronics } from './utils/non-apple-electronics.engine';

/**
 * Runtime projection of P6F fields already accepted by deterministic
 * authorities. It keeps commercial source text separate from the identity
 * used by Financial Classification and the shared profit catalog.
 */
export interface UsaNormalizedPricingContext {
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
}

/**
 * Server-only handoff from the USA cost boundary to existing pricing routes.
 * It intentionally carries no Paraguay import-cost components and no offer
 * draft fields. FinalCost.amountBrl is the single acquisition-cost authority.
 */
export interface UsaFinalCostPricingRequest {
  sourceProduct: UsaSourceProduct;
  finalCost: FinalCost;
  /** Already resolved by the existing source/condition authorities, or null. */
  condition: ProfitCondition | null;
  /** P6F-approved runtime fields; no Luna candidate is accepted directly here. */
  normalizedPricing?: UsaNormalizedPricingContext;
  /** Optional existing catalog authority; external USA products do not require it. */
  catalogProductId?: string | null;
  /** Existing deterministic manufacturer resolution, when already available. */
  manufacturerResolution?: ManufacturerResolution | null;
}

export type UsaPricingCalculationStatus =
  | 'ready'
  | 'classification_unresolved'
  | 'condition_unresolved'
  | 'missing_profit'
  | 'insufficient_identity'
  | 'ambiguous_identity'
  | 'collision';

export interface UsaFinalCostPricingResult {
  origin: 'US';
  sourceProductId: string;
  catalogProductId: string | null;
  acquisitionCost: number;
  financialClassification: FinancialClassification;
  financialClassificationReason: FinancialClassificationReason;
  manufacturerKey: string | null;
  financialIdentity: UsaNormalizedPricingContext & { condition: ProfitCondition | null };
  calculationStatus: UsaPricingCalculationStatus;
  calculationError: string | null;
  salePrice: number | null;
  offerPrice: number | null;
  margin: number | null;
  desiredNetProfit: number | null;
  pricingCosts: {
    fixedCost: number;
    freight: number;
    paymentFee: number;
    offerIncrement: number;
  } | null;
  profit: {
    source: 'native_product_catalog' | 'non_apple_electronics_policy' | 'unavailable';
    condition: ProfitCondition | null;
    productDescription: string;
    recordId: string | null;
    updatedAt: string;
  };
  engineMetadata?: ReturnType<typeof calculateNonAppleElectronics>;
}
