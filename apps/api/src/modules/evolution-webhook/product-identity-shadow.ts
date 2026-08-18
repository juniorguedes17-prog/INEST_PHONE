import {
  deriveExtendedProductIdentity,
  normalizeCanonicalText,
  profitIdentityPolicies,
  type ExtendedProductIdentity,
} from '@inest/product-identity';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

export type ProductIdShadowStatus = 'FOUND' | 'MISSING' | 'AMBIGUOUS';

export interface ProductIdShadowResolution {
  status: ProductIdShadowStatus;
  productId?: string;
  candidates?: string[];
  reason?: string;
  candidateCount: number;
}

export interface ProductIdShadowCandidate {
  id: string;
  productDescription: string | null;
  productType: string;
  profitCondition: string | null;
  variantAttributes: unknown;
  category: { name: string } | null;
  model: { name: string } | null;
  color: { name: string } | null;
  storage: { displayName: string; value: string; unit: string | null } | null;
}

export interface ProductIdentityShadowObservation {
  item: ParsedSupplierListItem;
  identity: ExtendedProductIdentity;
  productResolution: ProductIdShadowResolution;
}

export function processParsedSupplierItemsShadow(
  items: readonly ParsedSupplierListItem[],
  catalog: readonly ProductIdShadowCandidate[] = [],
): ProductIdentityShadowObservation[] {
  return items.map((item) => {
    const identity = deriveExtendedProductIdentity({
      productName: item.productName,
      category: item.category,
      model: item.model,
      capacity: item.capacity,
      color: item.color,
      quality: item.condition,
      notes: item.rawLine,
    });

    return { item, identity, productResolution: resolveProductIdShadow(identity, catalog) };
  });
}

export function resolveProductIdShadow(
  identity: ExtendedProductIdentity,
  catalog: readonly ProductIdShadowCandidate[],
): ProductIdShadowResolution {
  const policy = profitIdentityPolicies.find((item) => item.family === identity.variant.family);
  if (identity.variant.status !== 'valid' || !identity.variant.key || !policy) {
    return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
  }

  const targetDimensions = identityDimensions(identity);
  const candidates = catalog.filter((product) =>
    matchesCatalogProduct(product, identity, targetDimensions),
  );

  if (candidates.length === 1) {
    return { status: 'FOUND', productId: candidates[0]!.id, candidateCount: 1 };
  }
  if (candidates.length === 0) {
    return { status: 'MISSING', reason: 'catalog_no_match', candidateCount: 0 };
  }
  return {
    status: 'AMBIGUOUS',
    candidates: candidates.map((product) => product.id),
    reason: 'multiple_catalog_candidates',
    candidateCount: candidates.length,
  };
}

function matchesCatalogProduct(
  product: ProductIdShadowCandidate,
  target: ExtendedProductIdentity,
  targetDimensions: Readonly<Record<string, string>>,
) {
  const policy = profitIdentityPolicies.find((item) => item.family === target.variant.family);
  if (!policy) return false;

  // Legacy descriptions derive identity only; the comparison itself is made on
  // the Core dimensions plus Product's persisted structured fields.
  const candidateIdentity = deriveExtendedProductIdentity({
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName ?? product.storage?.value,
    quality: product.profitCondition,
    productType: product.productType,
  });
  if (candidateIdentity.variant.family !== target.variant.family) return false;

  const candidateDimensions = identityDimensions(candidateIdentity, product);
  const dimensions = [...policy.required, ...policy.optional];
  return dimensions.every((dimension) => {
    const targetValue = targetDimensions[dimension];
    if (!targetValue) return true;
    const candidateValue = candidateDimensions[dimension];
    return candidateValue !== undefined && candidateValue === targetValue;
  });
}

function identityDimensions(identity: ExtendedProductIdentity, product?: ProductIdShadowCandidate) {
  const dimensions: Record<string, string> = { ...identity.profit.attributes };
  if (product?.storage?.displayName ?? product?.storage?.value) {
    dimensions.storage = normalizeDimension(
      product.storage?.displayName ?? product.storage?.value ?? '',
    );
  }
  if (product?.profitCondition) {
    dimensions.condition = normalizeDimension(product.profitCondition);
  }
  if (isStringRecord(product?.variantAttributes)) {
    Object.entries(product.variantAttributes).forEach(([key, value]) => {
      dimensions[key] = normalizeDimension(value);
    });
  }
  return dimensions;
}

function normalizeDimension(value: string) {
  return normalizeCanonicalText(value).replace(/\s+/g, '-');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((attribute) => typeof attribute === 'string'),
  );
}
