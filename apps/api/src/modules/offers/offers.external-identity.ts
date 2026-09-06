export type ExternalOfferOrigin = 'US';

export interface ExternalOfferIdentity {
  origin: ExternalOfferOrigin;
  provider: string;
  sourceProductId: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  retailer?: string | null;
}

export interface OfferItemIdentityInput {
  productId?: string | null;
  externalIdentity?: Partial<ExternalOfferIdentity> | null;
}

export interface CanonicalOfferItemIdentity {
  kind: 'CANONICAL';
  productId: string;
}

export interface ExternalOfferItemIdentity {
  kind: 'EXTERNAL';
  productId: null;
  externalIdentity: Required<
    Pick<ExternalOfferIdentity, 'origin' | 'provider' | 'sourceProductId'>
  > &
    Omit<ExternalOfferIdentity, 'origin' | 'provider' | 'sourceProductId'>;
}

export type ResolvedOfferItemIdentity = CanonicalOfferItemIdentity | ExternalOfferItemIdentity;

export class OfferItemIdentityError extends Error {
  constructor(readonly reason: 'EXTERNAL_IDENTITY_REQUIRED') {
    super('Offer item requires a canonical Product or a complete external identity.');
    this.name = 'OfferItemIdentityError';
  }
}

/**
 * Resolves the single persisted identity for an offer item. A canonical
 * Product remains authoritative whenever it is present; external provenance
 * is only required when no catalog Product exists.
 */
export function resolveOfferItemIdentity(input: OfferItemIdentityInput): ResolvedOfferItemIdentity {
  const productId = requiredText(input.productId);
  if (productId) {
    return { kind: 'CANONICAL', productId };
  }

  const external = input.externalIdentity;
  const origin = requiredText(external?.origin);
  const provider = requiredText(external?.provider);
  const sourceProductId = requiredText(external?.sourceProductId);
  if (!origin || !provider || !sourceProductId) {
    throw new OfferItemIdentityError('EXTERNAL_IDENTITY_REQUIRED');
  }

  return {
    kind: 'EXTERNAL',
    productId: null,
    externalIdentity: {
      origin: origin as ExternalOfferOrigin,
      provider,
      sourceProductId,
      sourceName: optionalText(external?.sourceName),
      sourceUrl: optionalText(external?.sourceUrl),
      retailer: optionalText(external?.retailer),
    },
  };
}

function requiredText(value: string | null | undefined) {
  const normalized = optionalText(value);
  return normalized || null;
}

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}
