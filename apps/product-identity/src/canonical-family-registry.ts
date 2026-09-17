import { containsCanonicalPhrase, normalizeCanonicalText } from './canonical-text';

export type FinancialClassification = 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';

export const productIdentityFamilyKeys = [
  'iphone',
  'ipad',
  'macbook',
  'mac-mini',
  'imac',
  'mac-studio',
  'apple-watch',
  'airpods',
  'accessory',
  'unknown',
] as const;

export type ProductIdentityFamily = (typeof productIdentityFamilyKeys)[number];

export type CanonicalFamilyKey = Exclude<ProductIdentityFamily, 'unknown'>;
export type CanonicalFamilyClassification = Exclude<FinancialClassification, 'UNRESOLVED'>;
export type CanonicalFamilyResolutionStatus = 'matched' | 'ambiguous' | 'unresolved';

export interface CanonicalFamilyDefinition {
  key: CanonicalFamilyKey;
  label: string;
  classification: CanonicalFamilyClassification;
  aliases: readonly string[];
}

export type CanonicalFamilyResolution =
  | {
      status: 'matched';
      family: CanonicalFamilyKey;
      label: string;
      classification: CanonicalFamilyClassification;
    }
  | {
      status: 'ambiguous' | 'unresolved';
      family: 'unknown';
      label: null;
      classification: null;
    };

export const canonicalFamilyRegistry: readonly CanonicalFamilyDefinition[] = [
  { key: 'iphone', label: 'iPhone', classification: 'APPLE', aliases: ['iphone'] },
  { key: 'ipad', label: 'iPad', classification: 'APPLE', aliases: ['ipad'] },
  {
    key: 'macbook',
    label: 'MacBook',
    classification: 'APPLE',
    aliases: ['macbook', 'macbook air', 'macbook pro', 'macbook neo', 'mac air', 'mac pro', 'mac neo'],
  },
  { key: 'mac-mini', label: 'Mac Mini', classification: 'APPLE', aliases: ['mac mini'] },
  { key: 'imac', label: 'iMac', classification: 'APPLE', aliases: ['imac'] },
  { key: 'mac-studio', label: 'Mac Studio', classification: 'APPLE', aliases: ['mac studio'] },
  { key: 'apple-watch', label: 'Apple Watch', classification: 'APPLE', aliases: ['apple watch'] },
  { key: 'airpods', label: 'AirPods', classification: 'APPLE', aliases: ['airpods', 'air pods'] },
  {
    key: 'accessory',
    label: 'Apple Accessory',
    classification: 'APPLE',
    aliases: [
      'earpods',
      'ear pods',
      'apple pencil',
      'pencil apple',
      'magic mouse',
      'magic keyboard',
      'apple airtag',
      'airtag',
      'carregador apple',
      'cabo apple',
    ],
  },
] as const;

export function validateCanonicalFamilyRegistry(
  registry: readonly CanonicalFamilyDefinition[],
) {
  const keys = new Set<CanonicalFamilyKey>();
  const aliases = new Map<string, CanonicalFamilyKey>();
  const validKeys = new Set<ProductIdentityFamily>(productIdentityFamilyKeys);

  for (const definition of registry) {
    if (!validKeys.has(definition.key)) {
      throw new Error(`Invalid canonical family key: ${definition.key}`);
    }
    if (keys.has(definition.key)) {
      throw new Error(`Duplicate canonical family key: ${definition.key}`);
    }
    keys.add(definition.key);

    if (definition.aliases.length === 0) {
      throw new Error(`Canonical family requires aliases: ${definition.key}`);
    }

    for (const alias of definition.aliases) {
      const normalizedAlias = normalizeCanonicalText(alias);
      if (!normalizedAlias) {
        throw new Error(`Empty canonical family alias: ${definition.key}`);
      }
      const owner = aliases.get(normalizedAlias);
      if (owner && owner !== definition.key) {
        throw new Error(
          `Conflicting canonical family alias: ${normalizedAlias} (${owner}, ${definition.key})`,
        );
      }
      aliases.set(normalizedAlias, definition.key);
    }
  }
}

export function resolveCanonicalFamily(
  value: string,
  registry: readonly CanonicalFamilyDefinition[] = canonicalFamilyRegistry,
): CanonicalFamilyResolution {
  const text = normalizeCanonicalText(value);
  const matches = new Map<CanonicalFamilyKey, CanonicalFamilyDefinition>();

  for (const definition of registry) {
    if (
      definition.aliases.some((alias) =>
        containsCanonicalPhrase(text, normalizeCanonicalText(alias)),
      )
    ) {
      matches.set(definition.key, definition);
    }
  }

  if (matches.size === 0) {
    return { status: 'unresolved', family: 'unknown', label: null, classification: null };
  }
  if (matches.size > 1) {
    return { status: 'ambiguous', family: 'unknown', label: null, classification: null };
  }

  const definition = matches.values().next().value as CanonicalFamilyDefinition;
  return {
    status: 'matched',
    family: definition.key,
    label: definition.label,
    classification: definition.classification,
  };
}

export function findCanonicalFamilyDefinition(
  family: CanonicalFamilyKey,
  registry: readonly CanonicalFamilyDefinition[] = canonicalFamilyRegistry,
) {
  return registry.find((definition) => definition.key === family) ?? null;
}

validateCanonicalFamilyRegistry(canonicalFamilyRegistry);
