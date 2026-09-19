import { normalizeProductCondition, type ProductCondition } from '@inest/product-identity';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

export const TARGET_SUPPLIER_CONTACT_ID = '82c32e30-3646-4380-af38-e0b8dfe2914e';

export interface SupplierListPolicy {
  requireDocumentHeader: boolean;
  defaultCondition: ProductCondition | null;
}

const DEFAULT_SUPPLIER_LIST_POLICY: SupplierListPolicy = {
  requireDocumentHeader: true,
  defaultCondition: null,
};

const SUPPLIER_LIST_POLICIES: Readonly<Record<string, SupplierListPolicy>> = {
  [TARGET_SUPPLIER_CONTACT_ID]: {
    requireDocumentHeader: false,
    defaultCondition: 'NOVO',
  },
};

export function getSupplierListPolicy(supplierContactId: string): SupplierListPolicy {
  return SUPPLIER_LIST_POLICIES[supplierContactId] ?? DEFAULT_SUPPLIER_LIST_POLICY;
}

export function applySupplierListConditionPolicy(
  items: readonly ParsedSupplierListItem[],
  supplierContactId: string,
): ParsedSupplierListItem[] {
  const { defaultCondition } = getSupplierListPolicy(supplierContactId);
  if (!defaultCondition) return [...items];

  return items.map((item) => {
    if (item.condition !== null) return item;

    const evidence = normalizeProductCondition(
      [item.productName, item.rawLine, item.qualityGrade].filter(Boolean).join(' '),
    );
    if (evidence.status === 'RESOLVED') {
      return { ...item, condition: evidence.condition };
    }
    if (evidence.reason === 'conflicting') return item;

    return { ...item, condition: defaultCondition };
  });
}
