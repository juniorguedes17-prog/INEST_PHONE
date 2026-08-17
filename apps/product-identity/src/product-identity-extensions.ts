import {
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
  type CanonicalProductIdentity,
  type CanonicalProductSource,
} from './canonical-product-identity';
import { canonicalModelRegistry } from './canonical-model-registry';

export type ProductIdentityResolutionStatus =
  | 'valid'
  | 'insufficient_identity'
  | 'ambiguous_identity';

export type ProductIdentityFamily =
  | 'iphone'
  | 'ipad'
  | 'macbook'
  | 'mac-mini'
  | 'imac'
  | 'mac-studio'
  | 'apple-watch'
  | 'airpods'
  | 'accessory'
  | 'unknown';

export interface CanonicalVariantIdentity {
  status: ProductIdentityResolutionStatus;
  key: string | null;
  family: ProductIdentityFamily;
  canonicalModelKey: string | null;
  canonicalCondition: string | null;
  canonicalRam: string | null;
  canonicalStorage: string | null;
  canonicalScreen: string | null;
  canonicalConnectivity: string | null;
  canonicalChip: string | null;
  canonicalColor: string | null;
  commercialFinish: string | null;
  attributes: Readonly<Record<string, string>>;
  missingAttributes: readonly string[];
}

export interface ProfitLookupIdentity {
  status: ProductIdentityResolutionStatus;
  key: string | null;
  family: ProductIdentityFamily;
  canonicalModelKey: string | null;
  canonicalCondition: string | null;
  attributes: Readonly<Record<string, string>>;
  missingAttributes: readonly string[];
  ignoredDescriptors: readonly string[];
}

export interface ExtendedProductIdentity {
  canonical: CanonicalProductIdentity;
  variant: CanonicalVariantIdentity;
  profit: ProfitLookupIdentity;
}

type IdentityDimension =
  | 'model'
  | 'condition'
  | 'ram'
  | 'storage'
  | 'screen'
  | 'connectivity'
  | 'chip'
  | 'chipVariant'
  | 'cpu'
  | 'gpu'
  | 'connector'
  | 'length'
  | 'feature'
  | 'quantity'
  | 'power';

export interface ProfitIdentityPolicy {
  family: Exclude<ProductIdentityFamily, 'unknown'>;
  required: readonly IdentityDimension[];
  optional: readonly IdentityDimension[];
}

export const profitIdentityPolicies: readonly ProfitIdentityPolicy[] = [
  { family: 'iphone', required: ['model', 'storage', 'condition'], optional: [] },
  {
    family: 'ipad',
    required: ['model', 'screen', 'storage', 'condition'],
    optional: ['chip', 'connectivity'],
  },
  {
    family: 'macbook',
    required: ['model', 'screen', 'ram', 'storage', 'condition'],
    optional: ['chip', 'chipVariant'],
  },
  {
    family: 'mac-mini',
    required: ['model', 'ram', 'storage', 'condition'],
    optional: ['chip', 'chipVariant', 'cpu', 'gpu'],
  },
  {
    family: 'imac',
    required: ['model', 'screen', 'ram', 'storage', 'condition'],
    optional: ['chip', 'chipVariant', 'cpu', 'gpu'],
  },
  {
    family: 'mac-studio',
    required: ['model', 'ram', 'storage', 'condition'],
    optional: ['chip', 'chipVariant', 'cpu', 'gpu'],
  },
  {
    family: 'apple-watch',
    required: ['model', 'screen', 'condition'],
    optional: ['connectivity'],
  },
  {
    family: 'airpods',
    required: ['model', 'condition'],
    optional: ['feature', 'connector'],
  },
  {
    family: 'accessory',
    required: ['model', 'condition'],
    optional: ['connector', 'length', 'feature', 'quantity', 'power'],
  },
] as const;

interface IdentityContext {
  canonical: CanonicalProductIdentity;
  family: ProductIdentityFamily;
  text: string;
  values: Record<IdentityDimension, string | null>;
  commercialFinish: string | null;
  ignoredDescriptors: string[];
  ambiguity: boolean;
}

export interface ProfitIdentityAuditRecord {
  productId: string | number;
  productDescription: string;
  condition: string;
}

export interface ProfitIdentityCollision {
  key: string;
  records: readonly ProfitIdentityAuditRecord[];
}

export interface ProfitIdentityAuditResult {
  total: number;
  valid: number;
  insufficient: number;
  ambiguous: number;
  collisions: readonly ProfitIdentityCollision[];
}

export function deriveExtendedProductIdentity(
  input: CanonicalProductSource | string,
): ExtendedProductIdentity {
  const context = createIdentityContext(input);
  const profit = deriveProfitFromContext(context);
  const variant = deriveVariantFromContext(context, profit);

  return { canonical: context.canonical, variant, profit };
}

export function deriveProfitLookupIdentity(
  input: CanonicalProductSource | string,
): ProfitLookupIdentity {
  return deriveProfitFromContext(createIdentityContext(input));
}

export function deriveCanonicalVariantIdentity(
  input: CanonicalProductSource | string,
): CanonicalVariantIdentity {
  const context = createIdentityContext(input);
  return deriveVariantFromContext(context, deriveProfitFromContext(context));
}

export function auditProfitIdentityCatalog(
  records: readonly ProfitIdentityAuditRecord[],
): ProfitIdentityAuditResult {
  const groups = new Map<string, ProfitIdentityAuditRecord[]>();
  let valid = 0;
  let insufficient = 0;
  let ambiguous = 0;

  records.forEach((record) => {
    const identity = deriveProfitLookupIdentity({
      productDescription: record.productDescription,
      quality: record.condition,
    });

    if (identity.status === 'valid' && identity.key) {
      valid += 1;
      const group = groups.get(identity.key) ?? [];
      group.push(record);
      groups.set(identity.key, group);
    } else if (identity.status === 'ambiguous_identity') {
      ambiguous += 1;
    } else {
      insufficient += 1;
    }
  });

  const collisions = [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, records: group }));

  return { total: records.length, valid, insufficient, ambiguous, collisions };
}

function createIdentityContext(input: CanonicalProductSource | string): IdentityContext {
  const source = typeof input === 'string' ? { productName: input } : input;
  const canonical = normalizeCanonicalProductIdentity(source);
  const text = normalizeCanonicalText([
    source.productDescription,
    source.productName,
    source.category,
    source.model,
    source.capacity,
    source.color,
    source.quality,
    source.productType,
    source.notes,
  ].filter(Boolean).join(' '));
  const family = resolveFamily(canonical);
  const feature = resolveFeature(text);

  return {
    canonical,
    family,
    text,
    commercialFinish: resolveCommercialFinish(text),
    ignoredDescriptors: resolveIgnoredDescriptors(text, family),
    ambiguity: !canonical.canonicalModelMatched && hasConflictingRegistryMatches(text),
    values: {
      model: canonical.canonicalModelKey || null,
      condition: resolveExplicitCondition(source, text, canonical),
      ram: canonical.canonicalRam ?? resolveSlashRam(text),
      storage: canonical.canonicalStorage ?? resolveSlashStorage(text),
      screen: canonical.canonicalScreen,
      connectivity: canonical.canonicalConnectivity ?? resolveSupplementalConnectivity(text),
      chip: canonical.canonicalChip,
      chipVariant: resolveChipVariant(canonical.canonicalChip),
      cpu: resolveComputeUnits(text, 'cpu'),
      gpu: resolveComputeUnits(text, 'gpu'),
      connector: resolveConnector(text),
      length: resolveLength(text),
      feature,
      quantity: resolveQuantity(text),
      power: resolvePower(text),
    },
  };
}

function deriveProfitFromContext(context: IdentityContext): ProfitLookupIdentity {
  const policy = profitIdentityPolicies.find((item) => item.family === context.family);
  const required = policy ? contextualRequiredDimensions(policy, context) : ['model'] as const;
  const missingAttributes = required.filter((dimension) => !context.values[dimension]);
  const status = resolveStatus(context, Boolean(policy), missingAttributes);
  const dimensions = status === 'valid' && policy
    ? buildDimensions([...required, ...policy.optional], context.values)
    : {};

  return {
    status,
    key: status === 'valid' ? buildIdentityKey(context.family, dimensions) : null,
    family: context.family,
    canonicalModelKey: context.values.model,
    canonicalCondition: context.values.condition,
    attributes: dimensions,
    missingAttributes,
    ignoredDescriptors: context.ignoredDescriptors,
  };
}

function deriveVariantFromContext(
  context: IdentityContext,
  profit: ProfitLookupIdentity,
): CanonicalVariantIdentity {
  const dimensions = profit.status === 'valid'
    ? {
        ...profit.attributes,
        ...(context.canonical.canonicalColor
          ? { color: context.canonical.canonicalColor }
          : {}),
        ...(context.commercialFinish
          ? { commercialFinish: context.commercialFinish }
          : {}),
      }
    : {};

  return {
    status: profit.status,
    key: profit.status === 'valid' ? buildIdentityKey(context.family, dimensions) : null,
    family: context.family,
    canonicalModelKey: context.values.model,
    canonicalCondition: context.values.condition,
    canonicalRam: context.values.ram,
    canonicalStorage: context.values.storage,
    canonicalScreen: context.values.screen,
    canonicalConnectivity: context.values.connectivity,
    canonicalChip: context.values.chip,
    canonicalColor: context.canonical.canonicalColor,
    commercialFinish: context.commercialFinish,
    attributes: dimensions,
    missingAttributes: profit.missingAttributes,
  };
}

function contextualRequiredDimensions(
  policy: ProfitIdentityPolicy,
  context: IdentityContext,
): readonly IdentityDimension[] {
  if (policy.family === 'airpods' && context.values.model === 'airpods-4') {
    return [...policy.required, 'feature'];
  }
  if (policy.family === 'accessory' && context.values.model === 'airtag') {
    return [...policy.required, 'quantity'];
  }
  if (policy.family === 'accessory' && context.values.model === 'magic-keyboard') {
    return [...policy.required, 'feature'];
  }
  return policy.required;
}

function resolveStatus(
  context: IdentityContext,
  hasPolicy: boolean,
  missingAttributes: readonly string[],
): ProductIdentityResolutionStatus {
  if (context.ambiguity) return 'ambiguous_identity';
  if (!hasPolicy || !context.canonical.canonicalModelMatched || missingAttributes.length) {
    return 'insufficient_identity';
  }
  return 'valid';
}

function resolveFamily(identity: CanonicalProductIdentity): ProductIdentityFamily {
  const model = identity.canonicalModelKey;
  if (model.startsWith('iphone-')) return 'iphone';
  if (model.startsWith('ipad-')) return 'ipad';
  if (model.startsWith('mac-mini-')) return 'mac-mini';
  if (model.startsWith('imac-')) return 'imac';
  if (model.startsWith('mac-studio-')) return 'mac-studio';
  if (model.startsWith('macbook-')) return 'macbook';
  if (model.startsWith('apple-watch-')) return 'apple-watch';
  if (model.startsWith('airpods')) return 'airpods';
  if (identity.canonicalCategory === 'Acessorios' && model) return 'accessory';
  return 'unknown';
}

function resolveExplicitCondition(
  source: CanonicalProductSource,
  text: string,
  canonical: CanonicalProductIdentity,
) {
  if (source.quality?.trim()) return canonical.canonicalCondition;
  if (/\b(?:novo|new|lacrado|seminovo|semi novo|usado|vitrine|open box|swap|cpo|refurbished)\b/.test(text)) {
    return canonical.canonicalCondition;
  }
  return null;
}

function buildDimensions(
  dimensions: readonly IdentityDimension[],
  values: Readonly<Record<IdentityDimension, string | null>>,
) {
  return dimensions.reduce<Record<string, string>>((result, dimension) => {
    const value = values[dimension];
    if (value) result[dimension] = normalizeKeyPart(value);
    return result;
  }, {});
}

function buildIdentityKey(family: ProductIdentityFamily, dimensions: Readonly<Record<string, string>>) {
  return [family, ...Object.entries(dimensions).map(([name, value]) => `${name}=${value}`)].join('|');
}

function normalizeKeyPart(value: string) {
  return normalizeCanonicalText(value).replace(/\s+/g, '-');
}

function resolveSlashRam(text: string) {
  const match = text.match(/\b(\d{1,3})\s*\/\s*(?:\d{2,4}\s*gb|[1248]\s*tb)\b/);
  return match?.[1] ? `${Number(match[1])}GB` : null;
}

function resolveSlashStorage(text: string) {
  const match = text.match(/\b\d{1,3}\s*\/\s*(\d{2,4}\s*gb|[1248]\s*tb)\b/);
  if (!match?.[1]) return null;
  const value = match[1].replace(/\s+/g, '');
  return value.endsWith('tb') ? value.toUpperCase() : `${Number(value.replace('gb', ''))}GB`;
}

function resolveChipVariant(chip: string | null) {
  const match = chip?.match(/\b(Pro|Max|Ultra)\b/i);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function resolveComputeUnits(text: string, unit: 'cpu' | 'gpu') {
  const direct = text.match(new RegExp(`\\b(\\d{1,2})\\s*(?:core|nucleos?)?\\s*${unit}\\b`));
  const reverse = text.match(new RegExp(`\\b${unit}\\s*(\\d{1,2})\\b`));
  const value = direct?.[1] ?? reverse?.[1];
  return value ? `${Number(value)}-${unit}` : null;
}

function resolveConnector(text: string) {
  const usbC = /\b(?:usb\s*c|usbc|type\s*c)\b/.test(text);
  const lightning = /\blightning\b/.test(text);
  if (usbC && lightning) return 'USB-C + Lightning';
  if (usbC) return 'USB-C';
  if (lightning) return 'Lightning';
  return null;
}

function resolveSupplementalConnectivity(text: string) {
  if (/\b(?:com celular|wifi cellular|wi fi cellular)\b/.test(text)) {
    return 'GPS + Cellular';
  }
  return null;
}

function resolveLength(text: string) {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:m|metro|metros)\b/);
  return match?.[1] ? `${match[1]}m` : null;
}

function resolveFeature(text: string) {
  if (/\bsem\s+(?:cancelamento|anc)\b|\bregular\b/.test(text)) return 'regular';
  if (/\bcom\s+cancelamento\b|\banc\b|noise cancelling/.test(text)) return 'anc';
  if (/\bsem\s+teclado\s+numerico\b/.test(text)) return 'sem-teclado-numerico';
  if (/\bcom\s+teclado\s+numerico\b/.test(text)) return 'com-teclado-numerico';
  return null;
}

function resolveQuantity(text: string) {
  const match = text.match(/\b(\d+)\s*(?:pack|unidade|unidades|pcs?)\b/);
  return match?.[1] ? `${Number(match[1])}-unidades` : null;
}

function resolvePower(text: string) {
  const match = text.match(/\b(\d{1,3})\s*w\b/);
  return match?.[1] ? `${Number(match[1])}W` : null;
}

function resolveCommercialFinish(text: string) {
  const finishes = [
    ['black titanium', 'black-titanium'],
    ['space black', 'space-black'],
    ['jet black', 'jet-black'],
    ['midnight', 'midnight'],
    ['starlight', 'starlight'],
  ] as const;
  return finishes.find(([term]) => containsPhrase(text, term))?.[1] ?? null;
}

function resolveIgnoredDescriptors(text: string, family: ProductIdentityFamily) {
  if (family !== 'iphone') return [];
  const descriptors = [
    ['esim', 'esim'],
    ['americano', 'americano'],
    ['usa', 'usa'],
    ['eua', 'eua'],
  ] as const;
  return descriptors.filter(([term]) => containsPhrase(text, term)).map(([, label]) => label);
}

function hasConflictingRegistryMatches(text: string) {
  const matches = canonicalModelRegistry.flatMap((entry) =>
    entry.aliases
      .map(normalizeCanonicalText)
      .filter((alias) => alias && containsPhrase(text, alias))
      .map((alias) => ({ key: entry.key, category: entry.category, score: alias.length })),
  );
  if (!matches.length) return false;
  if (new Set(matches.map((match) => match.category)).size > 1) return true;
  const bestScore = Math.max(...matches.map((match) => match.score));
  return new Set(matches.filter((match) => match.score === bestScore).map((match) => match.key)).size > 1;
}

function containsPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
