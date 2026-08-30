import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ProductCondition, ProductType } from '@prisma/client';
import { getBaseModelName, getCategorySlug, getProductType } from './profit-products.seed';

const records = JSON.parse(
  readFileSync(new URL('./data/profit-products.json', import.meta.url), 'utf8'),
) as Array<{
  produto_id: number;
  condicao_produto: string;
  produto_descricao: string;
  lucro_liquido: number;
}>;

test('classifica AirPods Max 2 CPO no catalogo AirPods', () => {
  const condition = ProductCondition.CPO;
  const productType = getProductType('AirPods Max 2', condition);

  assert.equal(productType, ProductType.AIRPODS);
  assert.equal(getCategorySlug(productType, condition), 'airpods');
  assert.equal(getBaseModelName('AirPods Max 2', productType), 'AirPods Max 2');
});

test('versiona AirPods Max 2 CPO com lucro liquido aprovado', () => {
  const record = records.find((item) => item.produto_descricao === 'AirPods Max 2');

  assert.deepEqual(record, {
    produto_id: 133,
    condicao_produto: 'CPO',
    produto_descricao: 'AirPods Max 2',
    lucro_liquido: 500,
  });
});

test('preserva iPhone CPO no catalogo Apple CPO', () => {
  const condition = ProductCondition.CPO;
  const productType = getProductType('iPhone 16 Pro 128GB', condition);

  assert.equal(productType, ProductType.APPLE_CPO);
  assert.equal(getCategorySlug(productType, condition), 'apple-certified-pre-owned');
});
