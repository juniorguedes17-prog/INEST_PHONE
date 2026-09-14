import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  CreateProfitRegistrationModelDto,
  parseBrazilianDecimal,
  UpsertModelDto,
} from './product.dto';

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

describe('parseBrazilianDecimal', () => {
  it.each([
    ['590', 590],
    ['590,00', 590],
    ['1.090', 1090],
    ['1.090,00', 1090],
    ['R$ 1.090,00', 1090],
  ])('converts the Brazilian monetary input %s to %d', (input, expected) => {
    expect(parseBrazilianDecimal(input)).toBe(expected);
  });
});

describe('Product model DTO transition', () => {
  it('accepts atomic registration without canonicalModelKey', async () => {
    const dto = Object.assign(new CreateProfitRegistrationModelDto(), {
      name: 'iPhone 18 Pro Max',
      productType: 'IPHONE_SEALED',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('keeps canonicalModelKey accepted for legacy callers', async () => {
    const dto = Object.assign(new CreateProfitRegistrationModelDto(), {
      name: 'iPhone 17 Air',
      canonicalModelKey: 'iphone-17-air',
      productType: 'IPHONE_SEALED',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('accepts model creation without client-owned normalizedName', async () => {
    const dto = Object.assign(new UpsertModelDto(), {
      categoryId: CATEGORY_ID,
      name: 'iPhone 18 Pro Max',
      productType: 'IPHONE_SEALED',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('keeps explicit normalizedName accepted for legacy callers', async () => {
    const dto = Object.assign(new UpsertModelDto(), {
      categoryId: CATEGORY_ID,
      name: 'Modelo legado',
      normalizedName: 'modelo-legado',
      productType: 'ACCESSORY',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
