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

  it.each([
    ['R$ 6.650,00', 6650],
    ['\u{1F4B0}6,150', 6150],
    ['\u{1F4B5}11,800.00', 11800],
    ['7650R$', 7650],
    ['\u{1F4B2}6300,00$R', 6300],
  ])('interpreta o formato de moeda do WhatsApp %s como %d', (priceText, expectedPrice) => {
    const items = parseSupplierListText(`iPhone 17 Pro 256GB\nAzul ${priceText}`);

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe(expectedPrice);
  });

  it('preserva os valores por cor de uma lista de fornecedor', () => {
    const items = parseSupplierListText(`
      IPHONE
      17 PRO MAX 256GB
      SILVER R$ 7,150
      LARANJA R$ 7,100
      AZUL R$ 7,100
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: 'silver', price: 7150 }),
        expect.objectContaining({ color: 'laranja', price: 7100 }),
        expect.objectContaining({ color: 'azul', price: 7100 }),
      ]),
    );
  });

  it('preserva pontos como milhar quando a lista nao informa centavos', () => {
    const items = parseSupplierListText('iPhone 17 Pro Max 256GB\nSilver R$ 7.200');

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe(7200);
  });

  it('nao interpreta a capacidade do produto como preco', () => {
    const items = parseSupplierListText('iPhone 17 Pro 256GB\nAzul');

    expect(items).toHaveLength(0);
  });

  it('normaliza espacos, acentos e unidades sem alterar a capacidade', () => {
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('16gb');
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('512gb');
  });
});
