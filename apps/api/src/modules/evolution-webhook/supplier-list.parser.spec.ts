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

  it.each([
    [
      'iPhone',
      'IPH 15 128 GB',
      'Preto R$ 3.600',
      { productName: 'iPhone 15 128GB', category: 'iPhone', capacity: '128GB' },
      3600,
    ],
    [
      'MacBook',
      'MACBOOK AIR M5 13 INCH 16 RAM 512 GB',
      'MIDNIGHT R$ 7.650',
      { productName: 'MacBook Air M5 13" 16RAM 512GB', category: 'MacBook', capacity: '512GB' },
      7650,
    ],
    [
      'iPad',
      'IPAD PRO M5 11 IN 256 GB',
      'SILVER R$ 8.200',
      { productName: 'iPad Pro M5 11" 256GB', category: 'iPad', capacity: '256GB' },
      8200,
    ],
    [
      'Apple Watch',
      'APPLE WATCH S11 46 MM GPS CELLULAR',
      'BLACK R$ 2.200',
      { productName: 'Apple Watch S11 46MM GPS Cellular', category: 'Apple Watch', capacity: null },
      2200,
    ],
    [
      'AirPods',
      'AIR PODS 4 ANC',
      'WHITE R$ 1.045',
      { productName: 'AirPods 4 ANC', category: 'AirPods', capacity: null },
      1045,
    ],
  ])('normaliza uma cotacao de %s sem alterar o preco', (_category, heading, priceLine, expected, price) => {
    const [item] = parseSupplierListText(`${heading}\n${priceLine}`);

    expect(item).toMatchObject({ ...expected, price });
  });

  it('aceita uma cotacao valida desconhecida sem exigir categoria cadastrada', () => {
    const [item] = parseSupplierListText('Produto XYZ 512GB\nR$ 900');

    expect(item).toMatchObject({
      productName: 'Produto Xyz 512GB',
      category: null,
      capacity: '512GB',
      price: 900,
      rawLine: 'R$ 900',
    });
  });

  it('aceita produto e preco na mesma linha', () => {
    const [item] = parseSupplierListText('iPhone 17 R$ 5.000');

    expect(item).toMatchObject({
      productName: 'iPhone 17',
      category: 'iPhone',
      price: 5000,
    });
  });
});
