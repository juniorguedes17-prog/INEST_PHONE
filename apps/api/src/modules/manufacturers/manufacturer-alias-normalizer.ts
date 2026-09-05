import { normalizeCanonicalProductIdentity, normalizeCanonicalText } from '@inest/product-identity';

/**
 * Produces a stable lookup value only. Corporate suffixes remain meaningful:
 * `Bose Corporation` is not collapsed to `Bose`.
 */
export function normalizeManufacturerAlias(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The external-manufacturer registry cannot claim Apple or an Apple product
 * identity. Product Identity remains the single Apple authority.
 */
export function isReservedAppleManufacturerAlias(value: string | null | undefined) {
  const normalized = normalizeManufacturerAlias(value);
  if (!normalized) return false;

  const canonicalText = normalizeCanonicalText(value ?? '');
  if (canonicalText.split(' ').includes('apple')) return true;

  return normalizeCanonicalProductIdentity(value ?? '').canonicalModelMatched;
}

export function containsNormalizedManufacturerAlias(
  normalizedText: string,
  normalizedAlias: string,
) {
  if (!normalizedText || !normalizedAlias) return false;
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}
