import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveProfitRegistration } from './profit-registration';
import type { BrazilRadarQuotePricing } from '../types/pricing';

const item = {
  sourceQuoteId: 'quote-1',
  catalogProductId: null,
  product: {
    id: null,
    name: 'iPhone 17 Pro Max 2TB',
    category: 'iPhone',
    model: 'iPhone 17 Pro Max',
    capacity: '2TB',
    color: 'Preto',
    supplier: 'Fornecedor',
    city: 'Sao Paulo, SP',
    condition: 'NOVO' as const,
  },
  profit: {
    productDescription: 'iPhone 17 Pro Max 2TB',
  },
} as unknown as BrazilRadarQuotePricing;

const references = {
  categories: [{ id: 'category-iphone', name: 'iPhone' }],
  models: [{ id: 'model-17-pro-max', categoryId: 'category-iphone', name: 'iPhone 17 Pro Max' }],
  colors: [{ id: 'color-preto', name: 'Preto' }],
  storages: [{ id: 'storage-2tb', displayName: '2TB' }],
};

test('cria o payload nativo para cotacao sem Product correspondente', () => {
  const result = resolveProfitRegistration({
    item,
    netProfit: '1.090,00',
    products: [],
    references,
  });

  assert.deepEqual(result, {
    action: 'create',
    payload: {
      categoryId: 'category-iphone',
      modelId: 'model-17-pro-max',
      colorId: 'color-preto',
      storageId: 'storage-2tb',
      productType: 'IPHONE_SEALED',
      status: 'ACTIVE',
      productDescription: 'iPhone 17 Pro Max 2TB',
      profitCondition: 'NOVO',
      netProfit: '1.090,00',
    },
  });
});

test('atualiza Product existente sem criar duplicata', () => {
  const product = {
    id: 'product-1',
    categoryId: 'category-iphone',
    modelId: 'model-17-pro-max',
    colorId: 'color-preto',
    storageId: 'storage-2tb',
    productType: 'IPHONE_SEALED',
    status: 'ACTIVE',
    productDescription: 'iPhone 17 Pro Max 2TB',
    profitCondition: 'NOVO' as const,
    netProfit: null,
    active: true,
  };
  const result = resolveProfitRegistration({
    item,
    netProfit: '590,00',
    products: [product],
    references,
    catalogProduct: product,
  });

  assert.equal(result.action, 'update');
  if (result.action !== 'update') return;
  assert.equal(result.productId, 'product-1');
  assert.equal(result.payload.netProfit, '590,00');
  assert.equal(result.payload.productDescription, 'iPhone 17 Pro Max 2TB');
});

test('reutiliza o Product equivalente somente na mesma condicao', () => {
  const sameConditionProduct = {
    id: 'product-2',
    categoryId: 'category-iphone',
    modelId: 'model-17-pro-max',
    colorId: 'color-preto',
    storageId: 'storage-2tb',
    productType: 'IPHONE_SEALED',
    status: 'ACTIVE',
    productDescription: 'iPhone 17 Pro Max 2TB',
    profitCondition: 'NOVO' as const,
    netProfit: null,
    active: true,
  };
  const otherConditionProduct = {
    ...sameConditionProduct,
    id: 'product-3',
    profitCondition: 'SEMINOVO' as const,
  };

  const result = resolveProfitRegistration({
    item,
    netProfit: '1.090,00',
    products: [otherConditionProduct, sameConditionProduct],
    references,
  });

  assert.equal(result.action, 'update');
  if (result.action !== 'update') return;
  assert.equal(result.productId, 'product-2');
  assert.equal(result.payload.netProfit, '1.090,00');
});

test('nao cria Product quando o modelo nao possui identidade canonica segura', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: { ...item.product, name: 'Produto XYZ 512GB', model: 'Produto XYZ' },
      profit: { ...item.profit, productDescription: 'Produto XYZ 512GB' },
    },
    netProfit: '500',
    products: [],
    references,
  });

  assert.equal(result.action, 'incomplete');
});
