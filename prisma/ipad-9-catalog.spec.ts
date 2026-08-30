import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ProductCondition, ProductType } from '@prisma/client';
import { getBaseModelName, getCategorySlug, getProductType } from './profit-products.seed';

test('classifies the approved iPad 9 256GB Wi-Fi CPO catalog record deterministically', () => {
  const description = 'iPad 9 256GB Wi-Fi';
  const records = JSON.parse(
    readFileSync(new URL('./data/profit-products.json', import.meta.url), 'utf8'),
  ) as Array<{
    produto_id: number;
    condicao_produto: ProductCondition;
    produto_descricao: string;
    lucro_liquido: number;
  }>;
  const record = records.find(({ produto_id }) => produto_id === 134);

  assert.deepEqual(record, {
    produto_id: 134,
    condicao_produto: ProductCondition.CPO,
    produto_descricao: description,
    lucro_liquido: 500,
  });
  assert.equal(getProductType(description, ProductCondition.CPO), ProductType.IPAD);
  assert.equal(getCategorySlug(ProductType.IPAD, ProductCondition.CPO), 'ipad');
  assert.equal(getBaseModelName(description, ProductType.IPAD), 'iPad 9');
});
