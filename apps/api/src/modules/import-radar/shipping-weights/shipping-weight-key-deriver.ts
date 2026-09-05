import { normalizeCanonicalText } from '@inest/product-identity';
import type {
  ShippingWeightKeyInput,
  ShippingWeightKeyResolution,
} from './shipping-weight.contract';

export const SHIPPING_WEIGHT_KEY_VERSION = 'shipping:v1';

const ATTRIBUTE_ORDER = [
  'manufacturer',
  'family',
  'model',
  'condition',
  'composition',
  'ram',
  'storage',
  'screen',
  'connectivity',
  'chip',
  'chipVariant',
  'cpu',
  'gpu',
  'color',
  'commercialFinish',
  'connector',
  'length',
  'feature',
  'quantity',
  'power',
  'qualifiers',
] as const;

/**
 * Pure conservative key derivation. It serializes only normalized, resolved
 * logistics attributes and never accepts a partial identity as a key.
 */
export function deriveShippingWeightKey(
  input: ShippingWeightKeyInput,
): ShippingWeightKeyResolution {
  if (input.manufacturer.status === 'AMBIGUOUS') {
    return { status: 'KEY_AMBIGUOUS', ambiguousSources: ['manufacturer'] };
  }
  if (input.productIdentity.variant.status === 'ambiguous_identity') {
    return { status: 'KEY_AMBIGUOUS', ambiguousSources: ['product_identity'] };
  }

  const missingAttributes = missingRequiredAttributes(input);
  if (missingAttributes.length) {
    return { status: 'KEY_INSUFFICIENT', missingAttributes };
  }

  const attributes = buildAttributes(input);
  const shippingWeightKey = [
    SHIPPING_WEIGHT_KEY_VERSION,
    ...ATTRIBUTE_ORDER.flatMap((attribute) => {
      const value = attributes[attribute];
      return value ? [`${attribute}=${value}`] : [];
    }),
  ].join('|');

  return { status: 'KEY_RESOLVED', shippingWeightKey, attributes };
}

function missingRequiredAttributes(input: ShippingWeightKeyInput) {
  const missing: string[] = [];
  const { variant } = input.productIdentity;

  if (
    input.manufacturer.status !== 'RESOLVED' ||
    !normalizeValue(input.manufacturer.manufacturerKey)
  ) {
    missing.push('manufacturer');
  }
  if (variant.status !== 'valid') {
    missing.push(...variant.missingAttributes);
  }
  if (variant.family === 'unknown') missing.push('family');
  if (!normalizeValue(variant.canonicalModelKey)) missing.push('model');
  if (!normalizeValue(variant.canonicalCondition)) missing.push('condition');
  if (input.composition.kind === 'UNSTRUCTURED_BUNDLE') missing.push('bundle_signature');
  if (input.composition.kind === 'BUNDLE' && !normalizeValue(input.composition.bundleSignature)) {
    missing.push('bundle_signature');
  }

  return [...new Set(missing)].sort();
}

function buildAttributes(input: ShippingWeightKeyInput): Record<string, string> {
  const { variant, profit } = input.productIdentity;
  const sourceAttributes = variant.attributes;
  const attributes: Record<string, string> = {
    manufacturer: normalizeValue(
      input.manufacturer.status === 'RESOLVED' ? input.manufacturer.manufacturerKey : '',
    )!,
    family: normalizeValue(variant.family)!,
    model: normalizeValue(variant.canonicalModelKey)!,
    condition: normalizeValue(variant.canonicalCondition)!,
    composition:
      input.composition.kind === 'SINGLE_ITEM'
        ? 'single-item'
        : input.composition.kind === 'BUNDLE'
          ? normalizeValue(input.composition.bundleSignature)!
          : 'unstructured-bundle',
  };

  addAttribute(attributes, 'ram', variant.canonicalRam);
  addAttribute(attributes, 'storage', variant.canonicalStorage);
  addAttribute(attributes, 'screen', variant.canonicalScreen);
  addAttribute(attributes, 'connectivity', variant.canonicalConnectivity);
  addAttribute(attributes, 'chip', variant.canonicalChip);
  addAttribute(attributes, 'color', variant.canonicalColor);
  addAttribute(attributes, 'commercialFinish', variant.commercialFinish);

  for (const name of [
    'chipVariant',
    'cpu',
    'gpu',
    'connector',
    'length',
    'feature',
    'quantity',
    'power',
  ]) {
    addAttribute(attributes, name, sourceAttributes[name]);
  }

  const qualifiers = [...new Set(profit.ignoredDescriptors.map(normalizeValue).filter(Boolean))]
    .sort()
    .join(',');
  if (qualifiers) attributes.qualifiers = qualifiers;

  return attributes;
}

function addAttribute(
  attributes: Record<string, string>,
  name: string,
  value: string | null | undefined,
) {
  const normalized = normalizeValue(value);
  if (normalized) attributes[name] = normalized;
}

function normalizeValue(value: string | null | undefined) {
  const normalized = normalizeCanonicalText(value ?? '').replace(/\s+/g, '-');
  return normalized || null;
}
