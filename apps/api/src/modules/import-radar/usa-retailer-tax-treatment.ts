import type { UsaRedirector } from './usa-cost.contract';

export const USA_RETAILER_TAX_POLICY_VERSION = 'usa-retailer-tax:v3';

export type UsaTaxTreatment = 'EXEMPT' | 'TAXABLE' | 'UNRESOLVED';
export type UsaRetailerEvidenceProvenance = 'SOURCE_STORE' | 'EXPLICIT_RETAILER';

/**
 * The source adapter must mark an evidence as trusted only when its structured
 * server-side field represents the retailer where the product is purchased.
 */
export interface UsaRetailerEvidence {
  retailer: string | null | undefined;
  provenance: UsaRetailerEvidenceProvenance;
  isTrustedRetailer: boolean;
}

export interface UsaRetailerTaxTreatmentInput {
  /** Redirector is the fiscal authority selector; retailer alone is insufficient. */
  redirector: UsaRedirector;
  retailerEvidence?: readonly UsaRetailerEvidence[];
  /** Context only: manufacturer never contributes to tax treatment. */
  manufacturerKey?: string | null;
}

export interface NormalizedUsaRetailer {
  retailerKey: string;
  canonicalName: string;
}

export type UsaRetailerTaxTreatmentResolution =
  | {
      taxTreatment: 'EXEMPT' | 'TAXABLE';
      retailer: NormalizedUsaRetailer;
      provenance: readonly UsaRetailerEvidenceProvenance[];
    }
  | {
      taxTreatment: 'UNRESOLVED';
      reason:
        'REDIRECTOR_UNSUPPORTED' | 'RETAILER_MISSING' | 'RETAILER_UNTRUSTED' | 'RETAILER_CONFLICT';
      provenance: readonly UsaRetailerEvidenceProvenance[];
    };

interface UsaRetailerPolicyEntry {
  retailerKey: string;
  canonicalName: string;
  aliases: readonly string[];
  reiTaxTreatment: Exclude<UsaTaxTreatment, 'UNRESOLVED'>;
}

const retailerTaxPolicy: readonly UsaRetailerPolicyEntry[] = [
  {
    retailerKey: 'amazon',
    canonicalName: 'Amazon',
    aliases: ['amazon'],
    reiTaxTreatment: 'EXEMPT',
  },
  { retailerKey: 'ebay', canonicalName: 'eBay', aliases: ['ebay'], reiTaxTreatment: 'EXEMPT' },
  {
    retailerKey: 'walmart',
    canonicalName: 'Walmart',
    aliases: ['walmart'],
    reiTaxTreatment: 'EXEMPT',
  },
  {
    retailerKey: 'best-buy',
    canonicalName: 'Best Buy',
    aliases: ['best buy'],
    reiTaxTreatment: 'EXEMPT',
  },
  {
    retailerKey: 'bh-photo-video',
    canonicalName: 'B&H Photo Video',
    aliases: ['b h photo video', 'b h photo'],
    reiTaxTreatment: 'EXEMPT',
  },
  {
    retailerKey: 'adorama',
    canonicalName: 'Adorama',
    aliases: ['adorama'],
    reiTaxTreatment: 'EXEMPT',
  },
  {
    retailerKey: 'apple-store-usa',
    canonicalName: 'Apple Store USA',
    aliases: ['apple store', 'apple store usa', 'apple us store'],
    reiTaxTreatment: 'TAXABLE',
  },
] as const;

const retailersByAlias = new Map(
  retailerTaxPolicy.flatMap((entry) =>
    entry.aliases.map((alias) => [normalizeRetailerName(alias), entry] as const),
  ),
);

/**
 * Pure redirector-and-retailer TAX decision. It does not discover retailers,
 * call cost engines, use manufacturers, or infer from product text.
 */
export function resolveUsaRetailerTaxTreatment(
  input: UsaRetailerTaxTreatmentInput,
): UsaRetailerTaxTreatmentResolution {
  const evidence = input.retailerEvidence ?? [];
  const provenance = uniqueProvenance(evidence);

  if (!isUsaRedirector(input.redirector)) {
    return { taxTreatment: 'UNRESOLVED', reason: 'REDIRECTOR_UNSUPPORTED', provenance };
  }

  if (!evidence.length || evidence.every((item) => !normalizeRetailerName(item.retailer))) {
    return { taxTreatment: 'UNRESOLVED', reason: 'RETAILER_MISSING', provenance };
  }
  if (evidence.some((item) => !item.isTrustedRetailer)) {
    return { taxTreatment: 'UNRESOLVED', reason: 'RETAILER_UNTRUSTED', provenance };
  }

  const retailers = evidence
    .map(toNormalizedRetailer)
    .filter((retailer): retailer is NormalizedUsaRetailer => retailer !== null);
  const retailerKeys = new Set(retailers.map((retailer) => retailer.retailerKey));
  if (retailerKeys.size !== 1 || retailers.length !== evidence.length) {
    return { taxTreatment: 'UNRESOLVED', reason: 'RETAILER_CONFLICT', provenance };
  }

  const retailer = retailers[0]!;
  if (input.redirector === 'RED_DELAWARE') {
    return { taxTreatment: 'EXEMPT', retailer, provenance };
  }

  const policy = retailerTaxPolicy.find((entry) => entry.retailerKey === retailer.retailerKey);
  return {
    // For Rei do Importado, a reliably identified retailer outside the
    // operational whitelist is TAXABLE. Unknown identity remains blocked
    // above; this never upgrades absence into a fiscal conclusion.
    taxTreatment: policy?.reiTaxTreatment ?? 'TAXABLE',
    retailer,
    provenance,
  };
}

function isUsaRedirector(value: unknown): value is UsaRedirector {
  return value === 'RED_DELAWARE' || value === 'REI_DO_IMPORTADO';
}

function toNormalizedRetailer(evidence: UsaRetailerEvidence): NormalizedUsaRetailer | null {
  const normalized = normalizeRetailerName(evidence.retailer);
  if (!normalized) return null;

  const retailerPolicy = retailersByAlias.get(normalized);
  if (retailerPolicy) {
    return {
      retailerKey: retailerPolicy.retailerKey,
      canonicalName: retailerPolicy.canonicalName,
    };
  }

  return {
    retailerKey: normalized.replace(/\s+/g, '-'),
    canonicalName: collapseWhitespace(evidence.retailer!),
  };
}

function uniqueProvenance(
  evidence: readonly UsaRetailerEvidence[],
): readonly UsaRetailerEvidenceProvenance[] {
  return [...new Set(evidence.map((item) => item.provenance))];
}

function normalizeRetailerName(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}
