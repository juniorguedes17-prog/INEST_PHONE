import type { CanonicalProductSource } from '@inest/product-identity';
import {
  deriveVariantAttributes,
  equalVariantAttributes,
  validateVariantAttributes,
  type ProductVariantAttributes,
} from './variant-attributes';

export interface VariantAttributesBackfillProduct extends CanonicalProductSource {
  id: string;
  variantAttributes: unknown;
}

export interface VariantAttributesBackfillStore {
  updateVariantAttributes(id: string, attributes: ProductVariantAttributes): Promise<void>;
}

export interface VariantAttributesBackfillResult {
  productsEligible: number;
  auto: number;
  review: Array<{ id: string; reason: string }>;
  blocked: Array<{ id: string; reason: string }>;
  collisions: Array<{ key: string; productIds: string[] }>;
  updates: number;
  unchanged: number;
}

export async function backfillVariantAttributes(
  products: readonly VariantAttributesBackfillProduct[],
  store: VariantAttributesBackfillStore,
  dryRun: boolean,
): Promise<VariantAttributesBackfillResult> {
  const result: VariantAttributesBackfillResult = {
    productsEligible: products.length,
    auto: 0,
    review: [],
    blocked: [],
    collisions: [],
    updates: 0,
    unchanged: 0,
  };
  const derived = products.map((product) => ({ product, resolution: deriveVariantAttributes(product) }));
  const keys = new Map<string, string[]>();

  for (const { product, resolution } of derived) {
    if (resolution.status === 'auto' && resolution.canonicalKey) {
      keys.set(resolution.canonicalKey, [...(keys.get(resolution.canonicalKey) ?? []), product.id]);
    }
  }

  const collidingProductIds = new Set<string>();
  for (const [key, productIds] of keys) {
    if (productIds.length > 1) {
      result.collisions.push({ key, productIds });
      productIds.forEach((id) => collidingProductIds.add(id));
    }
  }

  for (const { product, resolution } of derived) {
    if (collidingProductIds.has(product.id)) {
      result.blocked.push({ id: product.id, reason: 'colisao_canonical_variant' });
      continue;
    }
    if (resolution.status === 'blocked') {
      result.blocked.push({ id: product.id, reason: resolution.reason ?? 'identidade_bloqueada' });
      continue;
    }
    if (resolution.status === 'review' || !resolution.attributes) {
      result.review.push({ id: product.id, reason: resolution.reason ?? 'revisao_necessaria' });
      continue;
    }

    let existing: ProductVariantAttributes | null = null;
    if (product.variantAttributes !== null && product.variantAttributes !== undefined) {
      try {
        existing = validateVariantAttributes(product.variantAttributes, resolution.family);
      } catch {
        result.review.push({ id: product.id, reason: 'variant_attributes_invalidos' });
        continue;
      }
    }

    result.auto += 1;
    if (existing && equalVariantAttributes(existing, resolution.attributes)) {
      result.unchanged += 1;
      continue;
    }
    if (existing) {
      result.review.push({ id: product.id, reason: 'variant_attributes_divergentes' });
      result.auto -= 1;
      continue;
    }
    if (!dryRun) {
      await store.updateVariantAttributes(product.id, resolution.attributes);
    }
    result.updates += 1;
  }

  return result;
}
