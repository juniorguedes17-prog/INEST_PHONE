import {
  deriveExtendedProductIdentity,
  normalizeCanonicalText,
  profitIdentityPolicies,
  type ExtendedProductIdentity,
} from '@inest/product-identity';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

export type ProductIdShadowStatus = 'FOUND' | 'MISSING' | 'AMBIGUOUS';
export type ProductIdShadowReason =
  'identity_insufficient' | 'catalog_no_match' | 'multiple_catalog_candidates';

export interface ProductIdShadowResolution {
  status: ProductIdShadowStatus;
  productId?: string;
  candidates?: string[];
  reason?: ProductIdShadowReason;
  candidateCount: number;
}

export interface ProductIdShadowCandidate {
  id: string;
  productDescription: string | null;
  productType: string;
  profitCondition: string | null;
  isAppleOriginal?: boolean | null;
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

    return { item, identity, productResolution: resolveProductIdShadow(identity, catalog, item) };
  });
}

export function resolveProductIdShadow(
  identity: ExtendedProductIdentity,
  catalog: readonly ProductIdShadowCandidate[],
  source?: Pick<ParsedSupplierListItem, 'model' | 'capacity' | 'color' | 'condition'>,
): ProductIdShadowResolution {
  const policy = profitIdentityPolicies.find((item) => item.family === identity.variant.family);
  if (identity.variant.status === 'ambiguous_identity') {
    return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
  }

  if (identity.variant.status === 'valid' && identity.variant.key && policy) {
    const targetDimensions = identityDimensions(identity);
    if (!targetDimensions.condition) {
      return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
    }
    const candidates = catalog.filter((product) =>
      matchesCatalogProduct(product, identity, targetDimensions),
    );

    if (candidates.length === 1) {
      return { status: 'FOUND', productId: candidates[0]!.id, candidateCount: 1 };
    }
    if (candidates.length > 1) {
      return {
        status: 'AMBIGUOUS',
        candidates: candidates.map((product) => product.id),
        reason: 'multiple_catalog_candidates',
        candidateCount: candidates.length,
      };
    }
    if (!source) {
      return { status: 'MISSING', reason: 'catalog_no_match', candidateCount: 0 };
    }
  }

  if (!source) {
    return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
  }
  return resolveDynamicCatalogProductId(identity, catalog, source);
}

/**
 * The static registry remains the first authority. This fallback only serves
 * a product model that is explicitly structured by the parser and already
 * exists in the cadastral catalog. It never attempts a fuzzy model match.
 */
function resolveDynamicCatalogProductId(
  identity: ExtendedProductIdentity,
  catalog: readonly ProductIdShadowCandidate[],
  source?: Pick<ParsedSupplierListItem, 'model' | 'capacity' | 'color' | 'condition'>,
): ProductIdShadowResolution {
  if (!source || !source.model || !source.condition) {
    return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
  }
  const policy = profitIdentityPolicies.find((item) => item.family === identity.canonical.canonicalFamily);
  const expectedProductType = resolveCatalogProductType(identity.canonical.canonicalFamily, source.condition);
  const targetDimensions = dynamicIdentityDimensions(identity, source);
  if (
    !policy ||
    !expectedProductType ||
    policy.required.some((dimension) => !targetDimensions[dimension])
  ) {
    return { status: 'MISSING', reason: 'identity_insufficient', candidateCount: 0 };
  }

  const candidates = catalog.filter((product) =>
    matchesDynamicCatalogProduct(product, identity, targetDimensions, expectedProductType),
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

function matchesDynamicCatalogProduct(
  product: ProductIdShadowCandidate,
  target: Readonly<ExtendedProductIdentity>,
  targetDimensions: Readonly<Record<string, string>>,
  expectedProductType: string,
) {
  if (product.productType !== expectedProductType) return false;
  const policy = profitIdentityPolicies.find((item) => item.family === target.canonical.canonicalFamily);
  if (!policy) return false;
  const candidateIdentity = deriveExtendedProductIdentity({
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName ?? product.storage?.value,
    quality: product.profitCondition,
    productType: product.productType,
  });
  const candidateDimensions = {
    ...dynamicIdentityDimensions(candidateIdentity, {
      model: product.model?.name ?? null,
      capacity: product.storage?.displayName ?? product.storage?.value ?? null,
      color: product.color?.name ?? null,
      condition: product.profitCondition,
    }),
    ...identityDimensions(candidateIdentity, product),
  };
  const dimensions = [...policy.required, ...policy.optional];
  if (
    !dimensions.every((dimension) => {
      const targetValue = targetDimensions[dimension];
      if (!targetValue) return true;
      return candidateDimensions[dimension] === targetValue;
    })
  ) {
    return false;
  }
  return !targetDimensions.color || candidateDimensions.color === targetDimensions.color;
}

function dynamicIdentityDimensions(
  identity: ExtendedProductIdentity,
  source: Pick<ParsedSupplierListItem, 'model' | 'capacity' | 'color' | 'condition'>,
) {
  const canonical = identity.canonical;
  return compactDimensions({
    model: source.model ? normalizeDimension(source.model) : null,
    condition: source.condition ? normalizeDimension(source.condition) : null,
    ram: canonical.canonicalRam,
    storage: canonical.canonicalStorage,
    screen: canonical.canonicalScreen,
    connectivity: canonical.canonicalConnectivity,
    chip: canonical.canonicalChip,
    chipVariant: canonical.canonicalChip?.toLocaleLowerCase('en-US').includes('pro')
      ? 'pro'
      : null,
    color: canonical.canonicalColor,
  });
}

function compactDimensions(values: Record<string, string | null>) {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry) => Boolean(entry[1]))
      .map(([key, value]) => [
        key,
        key === 'storage'
          ? normalizeStorageDimension(value!)
          : normalizeDimension(value!),
      ]),
  );
}

export function resolveCatalogProductType(family: string, condition: string | null) {
  if (!condition) return null;
  if (condition === 'SEMINOVO') return 'IPHONE_USED';
  if (family === 'iphone') return condition === 'CPO' ? 'APPLE_CPO' : 'IPHONE_SEALED';
  if (family === 'macbook' || family === 'mac-mini' || family === 'imac' || family === 'mac-studio') {
    return 'MACBOOK';
  }
  if (family === 'ipad') return 'IPAD';
  if (family === 'apple-watch') return 'APPLE_WATCH';
  if (family === 'airpods') return 'AIRPODS';
  if (family === 'accessory') return 'ACCESSORY';
  return null;
}

export function resolveCatalogCategorySlug(productType: string, condition: string) {
  if (condition === 'SEMINOVO') return 'iphone-seminovo';
  if (productType === 'APPLE_CPO') return 'apple-certified-pre-owned';
  const byType: Record<string, string> = {
    IPHONE_SEALED: 'iphone-lacrado',
    IPHONE_USED: 'iphone-seminovo',
    APPLE_CPO: 'apple-certified-pre-owned',
    MACBOOK: 'macbook',
    IPAD: 'ipad',
    APPLE_WATCH: 'apple-watch',
    AIRPODS: 'airpods',
    ACCESSORY: 'acessorios',
  };
  return byType[productType] ?? null;
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
  if (dimensions.storage) {
    dimensions.storage = normalizeStorageDimension(dimensions.storage);
  }
  if (product?.storage?.displayName ?? product?.storage?.value) {
    dimensions.storage = normalizeStorageDimension(
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

function normalizeStorageDimension(value: string) {
  return normalizeDimension(value).replace(/^(\d+(?:\.\d+)?)-(gb|tb)$/i, '$1$2');
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((attribute) => typeof attribute === 'string'),
  );
}
