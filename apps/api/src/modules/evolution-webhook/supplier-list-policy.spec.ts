import { describe, expect, it } from 'vitest';
import {
  applySupplierListConditionPolicy,
  getSupplierListPolicy,
  PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
  TARGET_SUPPLIER_CONTACT_ID,
  X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID,
  X_ATACADO_SUPPLIER_CONTACT_ID,
} from './supplier-list-policy';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

const GOVERNED_SUPPLIER_CONTACT_IDS = [
  TARGET_SUPPLIER_CONTACT_ID,
  PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
  X_ATACADO_SUPPLIER_CONTACT_ID,
  X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID,
] as const;

const item: ParsedSupplierListItem = {
  productName: 'iPhone 17 256GB',
  normalizedName: 'iphone 17 256gb',
  category: 'iPhone',
  model: 'iPhone 17',
  capacity: '256GB',
  color: 'Preto',
  condition: null,
  qualityGrade: null,
  price: 4600,
  availability: null,
  rawLine: 'Preto R$ 4.600',
};

describe('supplier list policy', () => {
  it.each(GOVERNED_SUPPLIER_CONTACT_IDS)(
    'configura o contato governado %s e mantém a policy default dos demais',
    (supplierContactId) => {
      expect(getSupplierListPolicy(supplierContactId)).toEqual({
        requireDocumentHeader: false,
        defaultCondition: 'NOVO',
      });
    },
  );

  it('mantém a policy default dos demais contatos', () => {
    expect(getSupplierListPolicy('another-supplier-contact-id')).toEqual({
      requireDocumentHeader: true,
      defaultCondition: null,
    });
  });

  it.each(GOVERNED_SUPPLIER_CONTACT_IDS)(
    'aplica NOVO somente quando a condição não possui evidência explícita para %s',
    (supplierContactId) => {
      expect(applySupplierListConditionPolicy([item], supplierContactId)[0]?.condition).toBe(
        'NOVO',
      );
      expect(
        applySupplierListConditionPolicy([{ ...item, condition: 'SEMINOVO' }], supplierContactId)[0]
          ?.condition,
      ).toBe('SEMINOVO');
      expect(
        applySupplierListConditionPolicy(
          [{ ...item, condition: null, rawLine: 'SWAP — Preto R$ 4.600' }],
          supplierContactId,
        )[0]?.condition,
      ).toBe('SEMINOVO');
    },
  );

  it('não mascara condição explícita conflitante com o default', () => {
    const conflictingItem = {
      ...item,
      productName: 'iPhone 17 NOVO SEMINOVO 256GB',
    };

    expect(
      applySupplierListConditionPolicy([conflictingItem], TARGET_SUPPLIER_CONTACT_ID)[0]?.condition,
    ).toBeNull();
  });

  it('não infere condição para outros contatos', () => {
    expect(
      applySupplierListConditionPolicy([item], 'another-supplier-contact-id')[0]?.condition,
    ).toBe(null);
  });
});
