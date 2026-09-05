import {
  containsNormalizedManufacturerAlias,
  normalizeManufacturerAlias,
} from './manufacturer-alias-normalizer';

export type ManufacturerResolutionProvenance =
  'EXPLICIT_SOURCE_VALIDATED' | 'DETERMINISTIC_ALIAS' | 'AI_CANDIDATE_VALIDATED';

/** Provenances owned by Financial Classification, not by this resolver. */
export type FinancialClassificationAuthorityProvenance =
  'CANONICAL_PRODUCT' | 'APPLE_CANONICAL_REGISTRY' | ManufacturerResolutionProvenance;

export type ManufacturerResolutionStatus = 'FOUND' | 'MISSING' | 'AMBIGUOUS';
export type ManufacturerResolutionMatchMode = 'EXACT_ALIAS' | 'TEXT_BOUNDARY';

export interface ManufacturerResolverAlias {
  id: string;
  alias: string;
  normalizedAlias: string;
  manufacturer: {
    id: string;
    manufacturerKey: string;
    canonicalName: string;
    status: 'ACTIVE' | 'INACTIVE';
  };
}

export interface ManufacturerResolverInput {
  evidence: string | null | undefined;
  matchMode: ManufacturerResolutionMatchMode;
  provenance: ManufacturerResolutionProvenance;
}

export type ManufacturerResolution =
  | {
      status: 'FOUND';
      manufacturerId: string;
      manufacturerKey: string;
      canonicalName: string;
      provenance: ManufacturerResolutionProvenance;
      normalizedEvidence: string;
      matchedAlias: string;
      normalizedAlias: string;
    }
  | {
      status: 'MISSING';
      normalizedEvidence: string;
    }
  | {
      status: 'AMBIGUOUS';
      normalizedEvidence: string;
      manufacturerKeys: string[];
    };

/**
 * Pure, deterministic resolver. It never ranks or chooses competing matches.
 */
export function resolveManufacturer(
  input: ManufacturerResolverInput,
  aliases: readonly ManufacturerResolverAlias[],
): ManufacturerResolution {
  const normalizedEvidence = normalizeManufacturerAlias(input.evidence);
  if (!normalizedEvidence) return { status: 'MISSING', normalizedEvidence };

  const matches = aliases.filter((alias) => {
    if (alias.manufacturer.status !== 'ACTIVE') return false;
    if (!alias.normalizedAlias) return false;
    return input.matchMode === 'EXACT_ALIAS'
      ? alias.normalizedAlias === normalizedEvidence
      : containsNormalizedManufacturerAlias(normalizedEvidence, alias.normalizedAlias);
  });
  const identities = new Map<string, ManufacturerResolverAlias>();
  for (const match of matches) {
    identities.set(match.manufacturer.id, match);
  }

  if (identities.size === 0) return { status: 'MISSING', normalizedEvidence };
  if (identities.size > 1) {
    return {
      status: 'AMBIGUOUS',
      normalizedEvidence,
      manufacturerKeys: [...identities.values()]
        .map((match) => match.manufacturer.manufacturerKey)
        .sort(),
    };
  }

  const match = identities.values().next().value as ManufacturerResolverAlias;
  return {
    status: 'FOUND',
    manufacturerId: match.manufacturer.id,
    manufacturerKey: match.manufacturer.manufacturerKey,
    canonicalName: match.manufacturer.canonicalName,
    provenance: input.provenance,
    normalizedEvidence,
    matchedAlias: match.alias,
    normalizedAlias: match.normalizedAlias,
  };
}
