import { describe, expect, it } from 'vitest';
import { ProfitLookupResult, ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import {
  compareProfitIdentityResults,
  ProfitIdentityShadowResolution,
  resolveProfitIdentityShadow,
} from './profit-identity-shadow';

function catalog(
  records: ProfitSheetCatalog['records'],
): ProfitSheetCatalog {
  return { records, fetchedAt: '2026-08-17T10:00:00.000Z' };
}

function record(
  productId: string,
  productDescription: string,
  condition: 'NOVO' | 'SEMINOVO' | 'CPO' = 'NOVO',
  netProfit = 500,
) {
  return {
    productId,
    condition,
    productDescription,
    normalizedDescription: productDescription.toLowerCase(),
    netProfit,
  };
}

describe('ProfitLookupIdentity shadow resolution', () => {
  it('separa iPhone base, Pro e Pro Max sem selecao cruzada', () => {
    const profitCatalog = catalog([
      record('34', 'iPhone 17 256GB'),
      record('38', 'iPhone 17 Pro 256GB'),
      record('41', 'iPhone 17 Pro Max 256GB'),
    ]);

    const cases = [
      ['iPhone 17 256GB', '34'],
      ['iPhone 17 Pro 256GB', '38'],
      ['iPhone 17 Pro Max 256GB', '41'],
    ] as const;

    cases.forEach(([productDescription, expectedId]) => {
      const result = resolveProfitIdentityShadow(profitCatalog, {
        productDescription,
        condition: 'NOVO',
      });
      expect(result.status).toBe('found');
      if (result.status === 'found') expect(result.record.productId).toBe(expectedId);
    });
  });

  it('ignora cor para lucro e preserva a mesma selecao financeira', () => {
    const profitCatalog = catalog([record('38', 'iPhone 17 Pro 256GB')]);
    const orange = resolveProfitIdentityShadow(profitCatalog, {
      productDescription: 'iPhone 17 Pro 256GB',
      condition: 'NOVO',
      color: 'Laranja',
    });
    const white = resolveProfitIdentityShadow(profitCatalog, {
      productDescription: 'iPhone 17 Pro 256GB',
      condition: 'NOVO',
      color: 'Branco',
    });

    expect(orange.status).toBe('found');
    expect(white.status).toBe('found');
    expect(orange.identity.key).toBe(white.identity.key);
    if (orange.status === 'found' && white.status === 'found') {
      expect(orange.record.productId).toBe('38');
      expect(white.record.productId).toBe('38');
    }
  });

  it('mantem NOVO, SEMINOVO e CPO independentes', () => {
    const profitCatalog = catalog([
      record('38', 'iPhone 17 Pro 256GB', 'NOVO', 500),
      record('100', 'iPhone 17 Pro 256GB', 'SEMINOVO', 400),
      record('116', 'iPhone 17 Pro 256GB', 'CPO', 450),
    ]);

    const cases = [
      ['NOVO', '38'],
      ['SEMINOVO', '100'],
      ['CPO', '116'],
    ] as const;

    cases.forEach(([condition, expectedId]) => {
      const result = resolveProfitIdentityShadow(profitCatalog, {
        productDescription: 'iPhone 17 Pro 256GB',
        condition,
      });
      expect(result.status).toBe('found');
      if (result.status === 'found') expect(result.record.productId).toBe(expectedId);
    });
  });

  it.each([
    ['iPad', '201', 'iPad Air M4 13" 128GB'],
    ['MacBook', '202', 'MacBook Air M5 13" 16/512GB'],
    ['Mac Mini', '203', 'Mac Mini M4 16/512GB'],
    ['Apple Watch', '204', 'Apple Watch Series 11 46mm GPS + Cellular'],
    ['AirPods', '205', 'AirPods 4 com cancelamento ANC'],
    ['acessorio', '206', 'Apple Pencil Pro'],
  ] as const)('resolve uma integracao minima de %s', (_family, productId, description) => {
    const result = resolveProfitIdentityShadow(catalog([record(productId, description)]), {
      productDescription: description,
      condition: 'NOVO',
    });

    expect(result.status).toBe('found');
    if (result.status === 'found') expect(result.record.productId).toBe(productId);
  });

  it('classifica as nove categorias de comparacao sem alterar resultados', () => {
    const first = record('38', 'iPhone 17 Pro 256GB');
    const second = record('41', 'iPhone 17 Pro Max 256GB');
    const found = resolveProfitIdentityShadow(catalog([first]), {
      productDescription: first.productDescription,
      condition: 'NOVO',
    });
    const missing = resolveProfitIdentityShadow(catalog([]), {
      productDescription: first.productDescription,
      condition: 'NOVO',
    });
    const insufficient = resolveProfitIdentityShadow(catalog([]), {
      productDescription: 'Cabo USB-C 2m',
      condition: 'NOVO',
    });
    const ambiguous = resolveProfitIdentityShadow(catalog([]), {
      productDescription: 'iPhone 17 Pro 256GB Apple Watch S11 46mm',
      condition: 'NOVO',
    });
    const collision = resolveProfitIdentityShadow(catalog([first, { ...first, productId: '138' }]), {
      productDescription: first.productDescription,
      condition: 'NOVO',
    });
    const legacyFound: ProfitLookupResult = { status: 'found', record: first };
    const legacyOther: ProfitLookupResult = { status: 'found', record: second };
    const legacyMissing: ProfitLookupResult = { status: 'not_found' };
    const legacyDuplicate: ProfitLookupResult = { status: 'duplicate', records: [first, second] };

    const cases: Array<[
      ProfitLookupResult,
      ProfitIdentityShadowResolution,
      ReturnType<typeof compareProfitIdentityResults>,
    ]> = [
      [legacyFound, found, 'AGREE_FOUND'],
      [legacyDuplicate, found, 'LEGACY_DUPLICATE_SHADOW_FOUND'],
      [legacyFound, missing, 'LEGACY_FOUND_SHADOW_MISSING'],
      [legacyFound, insufficient, 'LEGACY_FOUND_SHADOW_INSUFFICIENT'],
      [legacyMissing, found, 'LEGACY_MISSING_SHADOW_FOUND'],
      [legacyMissing, missing, 'BOTH_MISSING'],
      [legacyOther, found, 'IDENTITY_DISAGREEMENT'],
      [legacyMissing, ambiguous, 'SHADOW_AMBIGUOUS'],
      [legacyMissing, collision, 'SHADOW_COLLISION'],
    ];

    expect(cases.map(([legacy, shadow]) => compareProfitIdentityResults(legacy, shadow))).toEqual(
      cases.map(([, , expected]) => expected),
    );
  });
});
