import { normalizeCanonicalProductIdentity } from '@inest/product-identity';
import type {
  FinancialClassificationAuthorityProvenance,
  ManufacturerResolution,
} from '../manufacturers/manufacturer-resolver';

export type FinancialClassification = 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';
export type SourceManufacturerProvenance = 'EXPLICIT_SOURCE';

export type FinancialClassificationReason =
  | 'canonical_product'
  | 'apple_registry'
  | 'manufacturer_registry'
  | 'manufacturer_missing'
  | 'manufacturer_ambiguous'
  | 'manufacturer_conflict'
  | 'classification_unresolved';

export interface FinancialClassificationInput {
  canonicalProduct?: { isAppleOriginal?: boolean | null } | null;
  productName: string;
  category?: string | null;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  condition?: string | null;
  sourceManufacturer?: string | null;
  sourceManufacturerProvenance?: SourceManufacturerProvenance | null;
  manufacturerResolution?: ManufacturerResolution | null;
}

export interface FinancialClassificationResult {
  classification: FinancialClassification;
  reason: FinancialClassificationReason;
  manufacturerKey?: string;
  canonicalName?: string;
  provenance?: FinancialClassificationAuthorityProvenance;
}

export type PricingEligibilityStatus = 'ELIGIBLE' | 'NEEDS_INPUT' | 'BLOCKED';
export type PricingEligibilityInputType = 'MANUFACTURER';

/**
 * A server-side projection of Financial Classification for an interactive
 * source flow. It never introduces a second financial classifier.
 */
export interface PricingEligibilityDecision {
  status: PricingEligibilityStatus;
  reason:
    | 'classification_unresolved'
    | 'condition_unresolved'
    | 'financial_identity_insufficient'
    | 'financial_identity_ambiguous'
    | null;
  inputType?: PricingEligibilityInputType;
  diagnosticReason?: FinancialClassificationReason;
}

export function resolveClassificationPricingEligibility(
  classification: FinancialClassificationResult,
): PricingEligibilityDecision {
  if (classification.classification !== 'UNRESOLVED') {
    return { status: 'ELIGIBLE', reason: null };
  }
  if (classification.reason === 'manufacturer_missing') {
    return {
      status: 'NEEDS_INPUT',
      reason: 'classification_unresolved',
      inputType: 'MANUFACTURER',
      diagnosticReason: classification.reason,
    };
  }
  return {
    status: 'BLOCKED',
    reason: 'classification_unresolved',
    diagnosticReason: classification.reason,
  };
}

/**
 * Routes a source product financially. It deliberately never derives a
 * third-party manufacturer from product text, inferred brand, or AI output.
 */
export function resolveFinancialClassification(
  input: FinancialClassificationInput,
): FinancialClassificationResult {
  if (input.canonicalProduct?.isAppleOriginal === true) {
    return {
      classification: 'APPLE',
      reason: 'canonical_product',
      provenance: 'CANONICAL_PRODUCT',
    };
  }
  if (input.canonicalProduct?.isAppleOriginal === false) {
    return {
      classification: 'NON_APPLE',
      reason: 'canonical_product',
      provenance: 'CANONICAL_PRODUCT',
    };
  }

  const identity = normalizeCanonicalProductIdentity({
    productName: input.productName,
    category: input.category ?? undefined,
    model: input.model ?? undefined,
    capacity: input.capacity ?? undefined,
    color: input.color ?? undefined,
    quality: input.condition ?? undefined,
  });
  const appleByRegistry = identity.canonicalModelMatched;
  const manufacturer = input.manufacturerResolution ?? null;

  if (appleByRegistry) {
    if (manufacturer?.status === 'FOUND') {
      return { classification: 'UNRESOLVED', reason: 'manufacturer_conflict' };
    }
    return {
      classification: 'APPLE',
      reason: 'apple_registry',
      provenance: 'APPLE_CANONICAL_REGISTRY',
    };
  }

  if (manufacturer?.status === 'FOUND') {
    return {
      classification: 'NON_APPLE',
      reason: 'manufacturer_registry',
      manufacturerKey: manufacturer.manufacturerKey,
      canonicalName: manufacturer.canonicalName,
      provenance: manufacturer.provenance,
    };
  }
  if (manufacturer?.status === 'MISSING') {
    return { classification: 'UNRESOLVED', reason: 'manufacturer_missing' };
  }
  if (manufacturer?.status === 'AMBIGUOUS') {
    return { classification: 'UNRESOLVED', reason: 'manufacturer_ambiguous' };
  }

  return { classification: 'UNRESOLVED', reason: 'classification_unresolved' };
}
