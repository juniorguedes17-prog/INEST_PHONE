import { describe, expect, it } from 'vitest';
import { ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import {
  lookupProfit,
  mapProfitSheetValues,
  normalizeProfitProductDescription,
  parseBrazilianCurrency,
} from './google-sheets-profit.provider';

describe('GoogleSheetsProfitProvider mapping', () => {
  it('reads the four required headers even when columns are reordered', () => {
    const records = mapProfitSheetValues([
      ['lucro_liquido', 'produto_descricao', 'produto_id', 'condicao_produto'],
      ['R$ 1.190,00', 'iPhone 17 Pro Max 256GB', '42', 'NOVO'],
    ]);

    expect(records).toEqual([
      expect.objectContaining({
        productId: '42',
        condition: 'NOVO',
        productDescription: 'iPhone 17 Pro Max 256GB',
        netProfit: 1190,
      }),
    ]);
  });

  it('rejects a sheet without one of the four required headers', () => {
    expect(() =>
      mapProfitSheetValues([
        ['produto_id', 'condicao_produto', 'produto_descricao'],
        ['1', 'NOVO', 'iPhone 17 Pro 256GB'],
      ]),
    ).toThrow('lucro_liquido');
  });

  it.each([
    ['R$ 640,00', 640],
    ['R$ 1.190,00', 1190],
    ['1190.50', 1190.5],
  ])('converts Brazilian currency %s without changing its value', (input, expected) => {
    expect(parseBrazilianCurrency(input)).toBe(expected);
  });

  it('normalizes only safe spelling and formatting differences', () => {
    expect(
      normalizeProfitProductDescription('  MacBook \u00c1ir M5 13\u201d 16 GB / 512 GB '),
    ).toBe('macbook air m5 13 pol 16gb 512gb');
    expect(normalizeProfitProductDescription('MacBook Air M5 13 polegadas 16GB 512GB')).toBe(
      'macbook air m5 13 pol 16gb 512gb',
    );
  });
});

describe('profit lookup', () => {
  const catalog = catalogFrom([
    ['1', 'NOVO', 'iPhone 17 Pro 256GB', 'R$ 900,00'],
    ['2', 'NOVO', 'iPhone 17 Pro Max 256GB', 'R$ 1.190,00'],
    ['3', 'NOVO', 'iPhone 17 Pro Max 512GB', 'R$ 1.300,00'],
    ['4', 'SEMINOVO', 'iPhone 17 Pro Max 256GB', 'R$ 700,00'],
    ['5', 'CPO', 'iPhone 17 Pro Max 256GB', 'R$ 800,00'],
  ]);

  it('finds profit by exact product description and condition', () => {
    expect(lookupProfit(catalog, 'NOVO', 'IPHONE 17 PRO MAX 256 GB')).toMatchObject({
      status: 'found',
      record: { netProfit: 1190 },
    });
  });

  it('keeps NOVO, SEMINOVO and CPO separate', () => {
    expect(foundProfit(lookupProfit(catalog, 'NOVO', 'iPhone 17 Pro Max 256GB'))).toBe(1190);
    expect(foundProfit(lookupProfit(catalog, 'SEMINOVO', 'iPhone 17 Pro Max 256GB'))).toBe(700);
    expect(foundProfit(lookupProfit(catalog, 'CPO', 'iPhone 17 Pro Max 256GB'))).toBe(800);
  });

  it('does not confuse Pro with Pro Max or 256GB with 512GB', () => {
    expect(foundProfit(lookupProfit(catalog, 'NOVO', 'iPhone 17 Pro 256GB'))).toBe(900);
    expect(foundProfit(lookupProfit(catalog, 'NOVO', 'iPhone 17 Pro Max 512GB'))).toBe(1300);
    expect(lookupProfit(catalog, 'NOVO', 'iPhone 17 Pro 512GB')).toEqual({
      status: 'not_found',
    });
  });

  it('returns not_found when the exact registration does not exist', () => {
    expect(lookupProfit(catalog, 'NOVO', 'iPhone 18 Pro 256GB')).toEqual({
      status: 'not_found',
    });
  });

  it('reports duplicate registrations instead of selecting one', () => {
    const duplicateCatalog = catalogFrom([
      ['1', 'NOVO', 'iPhone 17 Pro Max 256GB', 'R$ 1.190,00'],
      ['2', 'NOVO', 'iPhone 17 Pro Max 256 GB', 'R$ 1.200,00'],
    ]);

    expect(lookupProfit(duplicateCatalog, 'NOVO', 'iPhone 17 Pro Max 256GB')).toMatchObject({
      status: 'duplicate',
      records: [{ netProfit: 1190 }, { netProfit: 1200 }],
    });
  });
});

function catalogFrom(rows: string[][]): ProfitSheetCatalog {
  return {
    records: mapProfitSheetValues([
      ['produto_id', 'condicao_produto', 'produto_descricao', 'lucro_liquido'],
      ...rows,
    ]),
    fetchedAt: '2026-07-14T00:00:00.000Z',
  };
}

function foundProfit(result: ReturnType<typeof lookupProfit>) {
  if (result.status !== 'found') throw new Error('Expected a unique profit record.');
  return result.record.netProfit;
}
