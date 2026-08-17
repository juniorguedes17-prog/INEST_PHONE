import { deriveExtendedProductIdentity, type ExtendedProductIdentity } from '@inest/product-identity';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

export interface ProductIdentityShadowObservation {
  item: ParsedSupplierListItem;
  identity: ExtendedProductIdentity;
}

export function processParsedSupplierItemsShadow(
  items: readonly ParsedSupplierListItem[],
): ProductIdentityShadowObservation[] {
  return items.map((item) => ({
    item,
    identity: deriveExtendedProductIdentity({
      productName: item.productName,
      category: item.category,
      model: item.model,
      capacity: item.capacity,
      color: item.color,
      quality: item.condition,
      notes: item.rawLine,
    }),
  }));
}
