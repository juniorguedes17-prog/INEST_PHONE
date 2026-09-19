import { describe, expect, it } from 'vitest';
import {
  applySupplierListConditionPolicy,
  getSupplierListPolicy,
  TARGET_SUPPLIER_CONTACT_ID,
} from './supplier-list-policy';
import type { ParsedSupplierListItem } from './evolution-webhook.types';

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
  it('configura somente o contato alvo e mantém a policy default dos demais', () => {
    expect(getSupplierListPolicy(TARGET_SUPPLIER_CONTACT_ID)).toEqual({
      requireDocumentHeader: false,
      defaultCondition: 'NOVO',
    });
    expect(getSupplierListPolicy('another-supplier-contact-id')).toEqual({
      requireDocumentHeader: true,
      defaultCondition: null,
    });
  });

  it('aplica NOVO somente quando a condição não possui evidência explícita', () => {
    expect(applySupplierListConditionPolicy([item], TARGET_SUPPLIER_CONTACT_ID)[0]?.condition).toBe(
      'NOVO',
    );
    expect(
      applySupplierListConditionPolicy(
        [{ ...item, condition: 'SEMINOVO' }],
        TARGET_SUPPLIER_CONTACT_ID,
      )[0]?.condition,
    ).toBe('SEMINOVO');
    expect(
      applySupplierListConditionPolicy(
        [{ ...item, condition: null, rawLine: 'SWAP — Preto R$ 4.600' }],
        TARGET_SUPPLIER_CONTACT_ID,
      )[0]?.condition,
    ).toBe('SEMINOVO');
  });

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
