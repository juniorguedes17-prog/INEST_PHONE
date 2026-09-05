import type { ExtendedProductIdentity } from '@inest/product-identity';
import type { SourceCommercialIdentity } from '../interfaces/source-commercial-identity.interface';

export type ShippingWeightManufacturerResolution =
  | { status: 'RESOLVED'; manufacturerKey: string }
  | { status: 'INSUFFICIENT' }
  | { status: 'AMBIGUOUS' };

/**
 * Composition is explicit because an unstructured bundle must never share a
 * shipping weight with a single commercial item by accident.
 */
export type ShippingWeightComposition =
  | { kind: 'SINGLE_ITEM' }
  | { kind: 'BUNDLE'; bundleSignature: string }
  | { kind: 'UNSTRUCTURED_BUNDLE' };

/**
 * Source data is retained only as provenance/context. None of these fields
 * participates in shippingWeightKey serialization.
 */
export interface ShippingWeightSourceContext {
  sourceCommercialIdentity?: SourceCommercialIdentity;
  sourceQuoteId?: string;
  store?: string;
  priceUsd?: number;
}

export interface ShippingWeightKeyInput {
  manufacturer: ShippingWeightManufacturerResolution;
  productIdentity: ExtendedProductIdentity;
  composition: ShippingWeightComposition;
  sourceContext?: ShippingWeightSourceContext;
}

export type ShippingWeightKeyResolution =
  | {
      status: 'KEY_RESOLVED';
      shippingWeightKey: string;
      attributes: Readonly<Record<string, string>>;
    }
  | { status: 'KEY_INSUFFICIENT'; missingAttributes: readonly string[] }
  | { status: 'KEY_AMBIGUOUS'; ambiguousSources: readonly string[] };

export interface ShippingWeightRecord {
  id: string;
  shippingWeightKey: string;
  shippingWeightLbs: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ShippingWeightResolution =
  | ({ status: 'WEIGHT_FOUND' } & ShippingWeightRecord)
  | { status: 'MISSING_WEIGHT'; shippingWeightKey: string }
  | Extract<ShippingWeightKeyResolution, { status: 'KEY_INSUFFICIENT' | 'KEY_AMBIGUOUS' }>;

export interface UpsertShippingWeightInput {
  shippingWeightKey: string;
  shippingWeightLbs: number;
  userId: string;
  context?: Readonly<Record<string, unknown>>;
}
