import { describe, expect, it } from 'vitest';
import { normalizeProductText, parseSupplierListText } from './supplier-list.parser';

describe('supplier list parser', () => {
  it('processa uma lista textual com produto, cor e preco em linhas separadas', () => {
    const items = parseSupplierListText(`
      IPHONES LACRADOS
      17 PRO MAX 256GB
      LARANJA R$ 6.650,00
      AZUL R$ 6.700,00
    `);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      category: 'iPhone',
      capacity: '256GB',
      color: 'laranja',
      condition: 'NOVO',
      price: 6650,
    });
    expect(items[1]?.price).toBe(6700);
  });

  it('mantem a condicao CPO e nao trata valores brasileiros como texto', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      iPhone 16 Pro 256GB CPO
      Preto 💰4.950
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ condition: 'CPO', price: 4950, color: 'preto' });
  });

  it('normaliza espacos, acentos e unidades sem alterar a capacidade', () => {
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('16gb');
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('512gb');
  });
});
