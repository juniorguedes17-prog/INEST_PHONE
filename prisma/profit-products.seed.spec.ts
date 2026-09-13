import assert from 'node:assert/strict';
import test from 'node:test';
import { ProductCondition, ProductType } from '@prisma/client';
import { buildProfitProductUpsertArgs } from './profit-products.seed';

const record = {
  produto_id: 61,
  condicao_produto: 'NOVO' as const,
  produto_descricao: 'Apple Watch Series 11 42mm GPS',
  lucro_liquido: 350,
};

const references = {
  categoryId: 'category-id',
  modelId: 'model-id',
  storageId: null,
  productType: ProductType.APPLE_WATCH,
  condition: ProductCondition.NOVO,
};

test('seed cria Product ausente com os dados do bootstrap', () => {
  const args = buildProfitProductUpsertArgs(record, references);

  assert.deepEqual(args.where, { profitProductId: 61 });
  assert.equal(args.create.productDescription, record.produto_descricao);
  assert.equal(args.create.status, 'ACTIVE');
  assert.equal(args.create.active, true);
});

test('seed preserva Product existente ativo ou inativo', () => {
  const args = buildProfitProductUpsertArgs(record, references);

  assert.deepEqual(args.update, {});
  assert.equal(Object.hasOwn(args.update, 'active'), false);
  assert.equal(Object.hasOwn(args.update, 'status'), false);
  assert.equal(Object.hasOwn(args.update, 'deletedAt'), false);
  assert.equal(Object.hasOwn(args.update, 'productDescription'), false);
});

test('seed permanece idempotente para o mesmo profitProductId', () => {
  const first = buildProfitProductUpsertArgs(record, references);
  const second = buildProfitProductUpsertArgs(record, references);

  assert.deepEqual(second, first);
});
