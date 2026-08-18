import {
  deriveExtendedProductIdentity,
  type CanonicalProductSource,
  type ProductIdentityFamily,
} from '@inest/product-identity';

export const variantAttributeKeysByFamily = {
  iphone: ['region', 'esim', 'commercialFinish'],
  ipad: ['chip', 'chipVariant', 'screen', 'connectivity'],
  macbook: ['chip', 'chipVariant', 'screen', 'ram', 'cpu', 'gpu'],
  'mac-mini': ['chip', 'chipVariant', 'ram', 'cpu', 'gpu'],
  imac: ['chip', 'chipVariant', 'screen', 'ram', 'cpu', 'gpu'],
  'mac-studio': ['chip', 'chipVariant', 'ram', 'cpu', 'gpu'],
  'apple-watch': ['screen', 'connectivity', 'feature', 'commercialFinish'],
  airpods: ['feature', 'connector'],
  accessory: ['connector', 'length', 'feature', 'quantity', 'power'],
  unknown: [],
} as const;

export type VariantAttributeKey =
  (typeof variantAttributeKeysByFamily)[keyof typeof variantAttributeKeysByFamily][number];

export type ProductVariantAttributes = Readonly<Partial<Record<VariantAttributeKey, string>>>;

export class VariantAttributesValidationError extends Error {}

export interface VariantAttributesDerivation {
  status: 'auto' | 'review' | 'blocked';
  family: ProductIdentityFamily;
  attributes?: ProductVariantAttributes;
  canonicalKey?: string;
  reason?: string;
}

export function validateVariantAttributes(
  value: unknown,
  family: ProductIdentityFamily,
): ProductVariantAttributes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VariantAttributesValidationError('variantAttributes deve ser um objeto.');
  }

  const allowed = new Set<string>(variantAttributeKeysByFamily[family]);
  const attributes: Partial<Record<VariantAttributeKey, string>> = {};

  for (const [key, attributeValue] of Object.entries(value)) {
    if (!allowed.has(key)) {
      throw new VariantAttributesValidationError(`Atributo de variante nao permitido: ${key}.`);
    }
    if (typeof attributeValue !== 'string' || !attributeValue.trim()) {
      throw new VariantAttributesValidationError(`Valor invalido para atributo de variante: ${key}.`);
    }
    attributes[key as VariantAttributeKey] = attributeValue;
  }

  return attributes;
}

export function deriveVariantAttributes(source: CanonicalProductSource): VariantAttributesDerivation {
  const identity = deriveExtendedProductIdentity(source);
  const { variant } = identity;

  if (variant.status === 'ambiguous_identity') {
    return { status: 'blocked', family: variant.family, reason: 'identidade_ambigua' };
  }
  if (variant.status !== 'valid' || !variant.key) {
    return { status: 'review', family: variant.family, reason: 'identidade_insuficiente' };
  }

  const candidates: Partial<Record<VariantAttributeKey, string | null>> = {
    chip: variant.canonicalChip,
    chipVariant: variant.attributes.chipVariant ?? null,
    screen: variant.canonicalScreen,
    ram: variant.canonicalRam,
    connectivity: variant.canonicalConnectivity,
    cpu: variant.attributes.cpu ?? null,
    gpu: variant.attributes.gpu ?? null,
    feature: variant.attributes.feature ?? null,
    connector: variant.attributes.connector ?? null,
    length: variant.attributes.length ?? null,
    quantity: variant.attributes.quantity ?? null,
    power: variant.attributes.power ?? null,
    commercialFinish: variant.commercialFinish,
  };
  const allowed = new Set<string>(variantAttributeKeysByFamily[variant.family]);
  const attributes = Object.fromEntries(
    Object.entries(candidates).filter(
      ([key, value]) => allowed.has(key) && typeof value === 'string' && value.length > 0,
    ),
  ) as ProductVariantAttributes;

  return {
    status: 'auto',
    family: variant.family,
    attributes: validateVariantAttributes(attributes, variant.family),
    canonicalKey: variant.key,
  };
}

export function equalVariantAttributes(
  left: ProductVariantAttributes,
  right: ProductVariantAttributes,
) {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}
