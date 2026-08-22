import type { CanonicalProductIdentity } from '@inest/product-identity';
import type {
  ProductIdShadowCandidate,
  ProductIdShadowReason,
  ProductIdShadowStatus,
} from '../../product-identity-shadow';
import type { ParsedSupplierListItem } from '../../evolution-webhook.types';

export interface GoldenParsedItemExpectation extends Partial<ParsedSupplierListItem> {
  itemIndex: number;
}

export interface GoldenIdentityExpectation extends Partial<
  Pick<
    CanonicalProductIdentity,
    | 'canonicalCategory'
    | 'canonicalModelKey'
    | 'canonicalCondition'
    | 'canonicalRam'
    | 'canonicalStorage'
    | 'canonicalScreen'
    | 'canonicalChip'
    | 'canonicalConnectivity'
  >
> {
  itemIndex: number;
}

export interface GoldenResolutionExpectation {
  itemIndex: number;
  status: ProductIdShadowStatus;
  reason?: ProductIdShadowReason;
  candidateCount: number;
  productKey?: string;
}

export interface GoldenCase {
  id: string;
  rule: string;
  originCommit?: string;
  notes?: string;
  input: { rawText: string };
  catalog?: readonly ProductIdShadowCandidate[];
  expected: {
    itemCount?: number;
    parsedItems?: readonly GoldenParsedItemExpectation[];
    identities?: readonly GoldenIdentityExpectation[];
    resolutions?: readonly GoldenResolutionExpectation[];
  };
}

export function defineGoldenCases(cases: readonly GoldenCase[]) {
  return cases;
}

export function goldenCatalogProduct(
  id: string,
  productDescription: string,
  profitCondition = 'NOVO',
  variantAttributes: unknown = null,
): ProductIdShadowCandidate {
  const storageMatch = [...productDescription.matchAll(/\b(\d+)\s*(GB|TB)\b/gi)].at(-1);
  const storage = storageMatch?.[1] ?? null;
  const storageUnit = storageMatch?.[2]?.toUpperCase() ?? null;
  const normalized = productDescription.toLowerCase();

  return {
    id,
    productDescription,
    productType: normalized.includes('ipad')
      ? 'IPAD'
      : normalized.includes('watch')
        ? 'APPLE_WATCH'
        : normalized.includes('mac')
          ? 'MACBOOK'
          : profitCondition === 'CPO'
            ? 'APPLE_CPO'
            : 'IPHONE_SEALED',
    profitCondition,
    variantAttributes,
    category: null,
    model: null,
    color: null,
    storage: storage
      ? { displayName: `${storage} ${storageUnit}`, value: storage, unit: storageUnit }
      : null,
  };
}
