import type { ProductType } from '@prisma/client';
import {
  normalizeCanonicalText,
  type ExtendedProductIdentity,
  type ProductIdentityFamily,
} from '@inest/product-identity';

export type LogisticProductClassification = 'CELULAR' | 'OTHER' | 'UNRESOLVED';

type ResolvedLogisticProductClassification = Exclude<LogisticProductClassification, 'UNRESOLVED'>;

export type LogisticClassificationSource =
  'PRODUCT_TYPE' | 'PRODUCT_IDENTITY_FAMILY' | 'CANONICAL_CATEGORY';

export interface LogisticProductClassificationInput {
  /** Product's existing canonical ProductType, when a catalog Product is already resolved. */
  productType?: ProductType | null;
  /** Extended Product Identity already derived by the calling server-side flow. */
  productIdentity?: ExtendedProductIdentity | null;
  /**
   * Only a category normalized by a trusted upstream authority may be supplied
   * here. Raw display names, sourceProductId, supplier, and retailer are not
   * classification authorities.
   */
  canonicalCategory?: string | null;
  /** Context only: a manufacturer alone never determines logistics type. */
  manufacturerKey?: string | null;
}

export type LogisticProductClassificationResolution =
  | {
      classification: 'CELULAR' | 'OTHER';
      sources: readonly LogisticClassificationSource[];
    }
  | {
      classification: 'UNRESOLVED';
      reason: 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE';
      sources: readonly LogisticClassificationSource[];
    };

const productTypeClassifications: Readonly<
  Record<ProductType, ResolvedLogisticProductClassification>
> = {
  IPHONE_SEALED: 'CELULAR',
  IPHONE_USED: 'CELULAR',
  APPLE_CPO: 'CELULAR',
  MACBOOK: 'OTHER',
  IPAD: 'OTHER',
  APPLE_WATCH: 'OTHER',
  AIRPODS: 'OTHER',
  ACCESSORY: 'OTHER',
};

const familyClassifications: Readonly<
  Partial<Record<ProductIdentityFamily, ResolvedLogisticProductClassification>>
> = {
  iphone: 'CELULAR',
  ipad: 'OTHER',
  macbook: 'OTHER',
  'mac-mini': 'OTHER',
  imac: 'OTHER',
  'mac-studio': 'OTHER',
  'apple-watch': 'OTHER',
  airpods: 'OTHER',
  accessory: 'OTHER',
};

const canonicalCategoryClassifications: Readonly<
  Record<string, ResolvedLogisticProductClassification>
> = {
  iphone: 'CELULAR',
  smartphone: 'CELULAR',
  smartphones: 'CELULAR',
  celular: 'CELULAR',
  celulares: 'CELULAR',
  'mobile-phone': 'CELULAR',
  'mobile-phones': 'CELULAR',
  airpods: 'OTHER',
  'apple-watch': 'OTHER',
  acessorio: 'OTHER',
  acessorios: 'OTHER',
  camera: 'OTHER',
  cameras: 'OTHER',
  'camera-fotografica': 'OTHER',
  'camera-fotograficas': 'OTHER',
  ipad: 'OTHER',
  laptop: 'OTHER',
  laptops: 'OTHER',
  macbook: 'OTHER',
  notebook: 'OTHER',
  notebooks: 'OTHER',
  smartwatch: 'OTHER',
  'smart-watch': 'OTHER',
  tablet: 'OTHER',
  tablets: 'OTHER',
};

/**
 * Resolves the logistics category from already-normalized authorities. It has
 * no persistence, fuzzy matching, AI, retailer policy, or cost-engine call.
 */
export function resolveLogisticProductClassification(
  input: LogisticProductClassificationInput,
): LogisticProductClassificationResolution {
  const evidence = collectEvidence(input);
  const sources = evidence.map((item) => item.source);
  const classifications = new Set(evidence.map((item) => item.classification));

  if (classifications.size === 0) {
    return {
      classification: 'UNRESOLVED',
      reason: 'INSUFFICIENT_EVIDENCE',
      sources,
    };
  }
  if (classifications.size > 1) {
    return {
      classification: 'UNRESOLVED',
      reason: 'CONFLICTING_EVIDENCE',
      sources,
    };
  }

  return {
    classification: evidence[0]!.classification,
    sources,
  };
}

function collectEvidence(
  input: LogisticProductClassificationInput,
): Array<{
  source: LogisticClassificationSource;
  classification: ResolvedLogisticProductClassification;
}> {
  const evidence: Array<{
    source: LogisticClassificationSource;
    classification: ResolvedLogisticProductClassification;
  }> = [];

  if (input.productType) {
    evidence.push({
      source: 'PRODUCT_TYPE',
      classification: productTypeClassifications[input.productType],
    });
  }

  const productIdentity = input.productIdentity;
  if (productIdentity?.canonical.canonicalModelMatched) {
    const classification = familyClassifications[productIdentity.variant.family];
    if (classification) {
      evidence.push({ source: 'PRODUCT_IDENTITY_FAMILY', classification });
    }
  }

  const canonicalCategory = normalizeCategory(input.canonicalCategory);
  const categoryClassification = canonicalCategory
    ? canonicalCategoryClassifications[canonicalCategory]
    : undefined;
  if (categoryClassification) {
    evidence.push({ source: 'CANONICAL_CATEGORY', classification: categoryClassification });
  }

  return evidence;
}

function normalizeCategory(value: string | null | undefined) {
  const normalized = normalizeCanonicalText(value ?? '').replace(/\s+/g, '-');
  return normalized || null;
}
