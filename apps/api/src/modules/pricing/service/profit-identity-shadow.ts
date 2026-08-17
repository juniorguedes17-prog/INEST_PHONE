import {
  deriveProfitLookupIdentity,
  type ProfitLookupIdentity,
} from '@inest/product-identity';
import {
  ProfitCondition,
  ProfitLookupResult,
  ProfitSheetCatalog,
  ProfitSheetRecord,
} from '../interfaces/profit-sheet.interface';

export type ProfitIdentityShadowResolution =
  | { status: 'found'; identity: ProfitLookupIdentity; record: ProfitSheetRecord }
  | { status: 'missing'; identity: ProfitLookupIdentity }
  | { status: 'insufficient_identity'; identity: ProfitLookupIdentity }
  | { status: 'ambiguous_identity'; identity: ProfitLookupIdentity }
  | {
      status: 'collision';
      identity: ProfitLookupIdentity;
      records: readonly ProfitSheetRecord[];
    };

export type ProfitIdentityShadowComparison =
  | 'AGREE_FOUND'
  | 'LEGACY_DUPLICATE_SHADOW_FOUND'
  | 'LEGACY_FOUND_SHADOW_MISSING'
  | 'LEGACY_FOUND_SHADOW_INSUFFICIENT'
  | 'LEGACY_MISSING_SHADOW_FOUND'
  | 'BOTH_MISSING'
  | 'IDENTITY_DISAGREEMENT'
  | 'SHADOW_AMBIGUOUS'
  | 'SHADOW_COLLISION';

export interface ProfitIdentityShadowSource {
  productDescription: string;
  condition: ProfitCondition;
  category?: string | null;
  color?: string | null;
}

export function resolveProfitIdentityShadow(
  catalog: ProfitSheetCatalog,
  source: ProfitIdentityShadowSource,
): ProfitIdentityShadowResolution {
  const identity = deriveProfitLookupIdentity({
    productDescription: source.productDescription,
    category: source.category,
    color: source.color,
    quality: source.condition,
  });

  if (identity.status === 'insufficient_identity') {
    return { status: 'insufficient_identity', identity };
  }
  if (identity.status === 'ambiguous_identity') {
    return { status: 'ambiguous_identity', identity };
  }

  const matches = catalog.records.filter((record) => {
    const candidate = deriveProfitLookupIdentity({
      productDescription: record.productDescription,
      quality: record.condition,
    });
    return candidate.status === 'valid' && candidate.key === identity.key;
  });

  const record = matches[0];
  if (!record) return { status: 'missing', identity };
  if (matches.length > 1) return { status: 'collision', identity, records: matches };
  return { status: 'found', identity, record };
}

export function compareProfitIdentityResults(
  legacy: ProfitLookupResult,
  shadow: ProfitIdentityShadowResolution,
): ProfitIdentityShadowComparison {
  if (shadow.status === 'ambiguous_identity') return 'SHADOW_AMBIGUOUS';
  if (shadow.status === 'collision') return 'SHADOW_COLLISION';

  if (shadow.status === 'found') {
    if (legacy.status === 'duplicate') return 'LEGACY_DUPLICATE_SHADOW_FOUND';
    if (legacy.status === 'not_found') return 'LEGACY_MISSING_SHADOW_FOUND';
    return legacy.record.productId === shadow.record.productId
      ? 'AGREE_FOUND'
      : 'IDENTITY_DISAGREEMENT';
  }

  if (shadow.status === 'insufficient_identity') {
    return legacy.status === 'found'
      ? 'LEGACY_FOUND_SHADOW_INSUFFICIENT'
      : legacy.status === 'not_found'
        ? 'BOTH_MISSING'
        : 'IDENTITY_DISAGREEMENT';
  }

  if (legacy.status === 'found') return 'LEGACY_FOUND_SHADOW_MISSING';
  return legacy.status === 'not_found' ? 'BOTH_MISSING' : 'IDENTITY_DISAGREEMENT';
}
