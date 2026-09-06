import { formatSourceDisplayName } from './source-display-name';
import type { ImportProviderProduct } from './interfaces/import-provider.interface';
import type { SourceCommercialIdentity } from './interfaces/source-commercial-identity.interface';

export type UsaSourceProductValidationReason =
  | 'PROVIDER_NAME_REQUIRED'
  | 'SOURCE_PRODUCT_ID_REQUIRED'
  | 'SOURCE_NAME_REQUIRED'
  | 'PRICE_USD_INVALID'
  | 'SOURCE_ORIGIN_INVALID';

export class UsaSourceProductValidationError extends Error {
  constructor(readonly reason: UsaSourceProductValidationReason) {
    super(`USA source product is invalid: ${reason}`);
    this.name = 'UsaSourceProductValidationError';
  }
}

/**
 * The common output every future USA provider must produce. It extends the
 * existing commercial identity instead of creating a parallel product model.
 * Provider, retailer, and manufacturer are deliberately independent fields.
 */
export interface UsaSourceProduct extends SourceCommercialIdentity<'US'> {
  providerName: string;
  retailer: string | null;
  category: string;
  model?: string;
  capacity?: string;
  color?: string;
  condition?: ImportProviderProduct['condition'];
  imageUrl?: string;
  priceUsd: number;
}

/**
 * A provider-specific result is adapted at the server boundary. No product is
 * materialized and no financial, logistics, TAX, or pricing decision occurs.
 */
export interface UsaSourceProductAdapterInput {
  providerName: string;
  product: ImportProviderProduct;
}

/**
 * Produces a USA source product from the existing shared provider result.
 * A missing retailer, manufacturer, URL, or optional product attribute stays
 * represented as missing context; later authorities decide eligibility.
 */
export function adaptUsaSourceProduct(input: UsaSourceProductAdapterInput): UsaSourceProduct {
  const providerName = requiredText(input.providerName, 'PROVIDER_NAME_REQUIRED');
  const product = input.product;
  const sourceProductId = requiredText(product.id, 'SOURCE_PRODUCT_ID_REQUIRED');
  const sourceName = requiredText(product.name, 'SOURCE_NAME_REQUIRED');

  if (!Number.isFinite(product.priceUsd) || product.priceUsd <= 0) {
    throw new UsaSourceProductValidationError('PRICE_USD_INVALID');
  }
  if (product.origin && product.origin !== 'US') {
    throw new UsaSourceProductValidationError('SOURCE_ORIGIN_INVALID');
  }

  const sourceManufacturer = optionalText(product.sourceManufacturer);
  const model = optionalText(product.model);
  const capacity = optionalText(product.capacity);
  const color = optionalText(product.color);
  const imageUrl = optionalText(product.imageUrl);

  return {
    providerName,
    sourceProductId,
    sourceName,
    displayName: formatSourceDisplayName({
      sourceName,
      sourceManufacturer,
      model,
      capacity,
    }),
    source: 'US',
    // The existing Source Commercial Identity keeps sourceUrl as a string.
    // Empty represents a source that has not supplied a URL; it is not a
    // reason to reject an otherwise valid external source product.
    sourceUrl: optionalText(product.productUrl) ?? '',
    supplier: optionalText(product.store) ?? '',
    sourceManufacturer,
    sourceManufacturerProvenance: sourceManufacturer
      ? (product.sourceManufacturerProvenance ?? null)
      : null,
    retailer: optionalText(product.retailer),
    category: product.category,
    ...(model ? { model } : {}),
    ...(capacity ? { capacity } : {}),
    ...(color ? { color } : {}),
    condition: product.condition,
    ...(imageUrl ? { imageUrl } : {}),
    priceUsd: product.priceUsd,
  };
}

function requiredText(value: string | null | undefined, reason: UsaSourceProductValidationReason) {
  const normalized = optionalText(value);
  if (!normalized) throw new UsaSourceProductValidationError(reason);
  return normalized;
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}
