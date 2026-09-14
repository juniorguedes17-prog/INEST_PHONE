import { describe, expect, it } from 'vitest';
import {
  buildProductModelNormalizedName,
  normalizeProductModelNameComponent,
} from './product-model-normalizer';

const CATEGORY_A = '11111111-1111-4111-8111-111111111111';
const CATEGORY_B = '22222222-2222-4222-8222-222222222222';

describe('ProductModel cadastral normalization', () => {
  it.each([
    'iPhone 18 Pro Max',
    'IPHONE 18 PRO MAX',
    'iPhone   18   Pro Max',
    'iPhone 18 Pró Max',
    'iPhone-18-Pro-Max',
  ])('normalizes equivalent spelling %s mechanically', (modelName) => {
    expect(normalizeProductModelNameComponent(modelName)).toBe('iphone-18-pro-max');
  });

  it('does not infer semantic equivalence between distinct model names', () => {
    expect(normalizeProductModelNameComponent('iPhone 18 Pro')).not.toBe(
      normalizeProductModelNameComponent('iPhone 18 Pro Max'),
    );
    expect(normalizeProductModelNameComponent('iPhone 17 Air')).not.toBe(
      normalizeProductModelNameComponent('iPhone Air'),
    );
    expect(normalizeProductModelNameComponent('iPhone 16e')).toBe('iphone-16e');
    expect(normalizeProductModelNameComponent('Apple Pencil Pro')).toBe('apple-pencil-pro');
  });

  it('namespaces equal model names by stable category id', () => {
    const first = buildProductModelNormalizedName({
      categoryId: CATEGORY_A,
      modelName: 'iPhone 18 Pro Max',
    });
    const second = buildProductModelNormalizedName({
      categoryId: CATEGORY_B,
      modelName: 'IPHONE 18 PRO MAX',
    });

    expect(first).toBe(`category:${CATEGORY_A}:iphone-18-pro-max`);
    expect(second).toBe(`category:${CATEGORY_B}:iphone-18-pro-max`);
    expect(first).not.toBe(second);
  });

  it('uses a deterministic full-input digest without exceeding VARCHAR(160)', () => {
    const sharedPrefix = 'a'.repeat(159);
    const first = buildProductModelNormalizedName({
      categoryId: CATEGORY_A,
      modelName: `${sharedPrefix}a`,
    });
    const repeated = buildProductModelNormalizedName({
      categoryId: CATEGORY_A,
      modelName: `${sharedPrefix}a`,
    });
    const second = buildProductModelNormalizedName({
      categoryId: CATEGORY_A,
      modelName: `${sharedPrefix}b`,
    });

    expect(first).toHaveLength(160);
    expect(first).toBe(repeated);
    expect(first).not.toBe(second);
  });
});
