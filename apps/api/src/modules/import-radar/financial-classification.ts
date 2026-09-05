import { normalizeCanonicalProductIdentity } from '@inest/product-identity';

export type FinancialClassification = 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';
export type SourceManufacturerProvenance = 'EXPLICIT_SOURCE';

export type FinancialClassificationReason =
  | 'canonical_product'
  | 'apple_registry'
  | 'source_manufacturer'
  | 'classification_unresolved'
  | 'classification_conflict';

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
}

export interface FinancialClassificationResult {
  classification: FinancialClassification;
  reason: FinancialClassificationReason;
}

/**
 * Routes a source product financially. It deliberately never derives a
 * third-party manufacturer from product text, inferred brand, or AI output.
 */
export function resolveFinancialClassification(
  input: FinancialClassificationInput,
): FinancialClassificationResult {
  if (input.canonicalProduct?.isAppleOriginal === true) {
    return { classification: 'APPLE', reason: 'canonical_product' };
  }
  if (input.canonicalProduct?.isAppleOriginal === false) {
    return { classification: 'NON_APPLE', reason: 'canonical_product' };
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
  const manufacturer = normalizeManufacturer(input.sourceManufacturer);
  const authoritativeManufacturer =
    manufacturer !== null && input.sourceManufacturerProvenance === 'EXPLICIT_SOURCE';

  if (appleByRegistry) {
    if (authoritativeManufacturer && manufacturer !== 'apple') {
      return { classification: 'UNRESOLVED', reason: 'classification_conflict' };
    }
    return { classification: 'APPLE', reason: 'apple_registry' };
  }

  if (authoritativeManufacturer && manufacturer !== 'apple') {
    return { classification: 'NON_APPLE', reason: 'source_manufacturer' };
  }

  return { classification: 'UNRESOLVED', reason: 'classification_unresolved' };
}

function normalizeManufacturer(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') ?? '';
  return normalized || null;
}
