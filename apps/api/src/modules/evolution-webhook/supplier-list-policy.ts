import { normalizeProductCondition, type ProductCondition } from '@inest/product-identity';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

export const TARGET_SUPPLIER_CONTACT_ID = '82c32e30-3646-4380-af38-e0b8dfe2914e';
export const PRONINE_ATACADO_SUPPLIER_CONTACT_ID = '3d8643ed-a845-c45d-4d77-c90693c8d82e';
export const X_ATACADO_SUPPLIER_CONTACT_ID = 'f98b1be8-cd04-41f4-98b4-790b6e9c16d4';
export const X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID = '422062a1-94e1-42f0-9084-c0be6a1f2770';
export const BROCKTECH_SUPPLIER_CONTACT_IDS = [
  '56d640d8-a710-e61c-d5b1-ac67c78854e4',
  '0b07a06b-c38d-e097-d92e-bd6aa06ab691',
  '29493f70-35a0-b10c-7854-e2a694c9bba3',
  '46895e99-9793-6540-69ce-ec537f84f4be',
] as const;

export interface SupplierListPolicy {
  requireDocumentHeader: boolean;
  defaultCondition: ProductCondition | null;
  inheritPartialConditionFromCurrentList?: boolean;
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
  [PRONINE_ATACADO_SUPPLIER_CONTACT_ID]: {
    requireDocumentHeader: false,
    defaultCondition: 'NOVO',
  },
  [X_ATACADO_SUPPLIER_CONTACT_ID]: {
    requireDocumentHeader: false,
    defaultCondition: 'NOVO',
  },
  [X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID]: {
    requireDocumentHeader: false,
    defaultCondition: 'NOVO',
  },
  ...Object.fromEntries(
    BROCKTECH_SUPPLIER_CONTACT_IDS.map((supplierContactId) => [
      supplierContactId,
      {
        requireDocumentHeader: false,
        defaultCondition: null,
        inheritPartialConditionFromCurrentList: true,
      },
    ]),
  ),
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
