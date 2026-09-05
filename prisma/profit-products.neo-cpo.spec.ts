import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { ProductCondition, ProductType } from '@prisma/client';
import { getBaseModelName, getProductType } from './profit-products.seed';

type ProfitSeedProduct = {
  produto_id: number;
  condicao_produto: string;
  produto_descricao: string;
  lucro_liquido: number;
};

const profitProducts = JSON.parse(
  readFileSync(resolve(process.cwd(), 'prisma/data/profit-products.json'), 'utf8'),
) as ProfitSeedProduct[];

test('catalog contains only the approved MacBook Neo 13-inch 8GB/256GB CPO product', () => {
  const neoCpoProducts = profitProducts.filter(
    (product) =>
      product.condicao_produto === 'CPO' && product.produto_descricao.startsWith('MacBook Neo'),
  );

  assert.deepEqual(neoCpoProducts, [
    {
      produto_id: 135,
      condicao_produto: 'CPO',
      produto_descricao: 'MacBook Neo A18 Pro 13" 8GB/256GB',
      lucro_liquido: 500,
    },
  ]);
  assert.equal(
    getBaseModelName(neoCpoProducts[0]!.produto_descricao, ProductType.MACBOOK),
    'MacBook Neo 13"',
  );
  assert.equal(
    getProductType(neoCpoProducts[0]!.produto_descricao, ProductCondition.CPO),
    ProductType.MACBOOK,
  );
  assert.equal(
    profitProducts.some(
      (product) =>
        product.condicao_produto === 'CPO' &&
        product.produto_descricao.includes('MacBook Neo') &&
        product.produto_descricao.includes('512GB'),
    ),
    false,
  );
});
