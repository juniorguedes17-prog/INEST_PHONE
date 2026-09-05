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
  categories: [{ id: 'category-iphone', name: 'iPhone Lacrado', type: 'IPHONE_SEALED' }],
  models: [
    {
      id: 'model-17-pro-max',
      categoryId: 'category-iphone',
      name: 'iPhone 17 Pro Max',
      productType: 'IPHONE_SEALED',
    },
  ],
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

test('resolve a categoria comercial por tipo, sem depender do label canonico', () => {
  const result = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references,
  });

  assert.equal(result.action, 'create');
  if (result.action !== 'create') return;
  assert.equal(result.payload.categoryId, 'category-iphone');
  assert.equal(result.payload.productType, 'IPHONE_SEALED');
});

test('falha de forma fechada quando o Model canonico esta ausente', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: {
        ...item.product,
        name: 'iPhone 17 Air 256GB',
        model: 'iPhone 17 Air',
        capacity: '256GB',
      },
      profit: { ...item.profit, productDescription: 'iPhone 17 Air 256GB' },
    },
    netProfit: '500',
    products: [],
    references: {
      ...references,
      models: [],
      storages: [{ id: 'storage-256', displayName: '256GB' }],
    },
  });

  assert.equal(result.action, 'incomplete');
  if (result.action !== 'incomplete') return;
  assert.equal(result.reason, 'NO_CANONICAL_MODEL');
});

test('resolve categorias comerciais distintas para CPO e SEMINOVO', () => {
  const cases = [
    { condition: 'CPO' as const, type: 'APPLE_CPO', categoryId: 'category-cpo' },
    { condition: 'SEMINOVO' as const, type: 'IPHONE_USED', categoryId: 'category-used' },
  ];

  cases.forEach(({ condition, type, categoryId }) => {
    const result = resolveProfitRegistration({
      item: {
        ...item,
        product: { ...item.product, condition },
      },
      netProfit: '500',
      products: [],
      references: {
        ...references,
        categories: [{ id: categoryId, name: 'Categoria comercial', type }],
        models: [
          {
            id: `model-${condition}`,
            categoryId,
            name: 'iPhone 17 Pro Max',
            productType: type,
          },
        ],
      },
    });

    assert.equal(result.action, 'create');
    if (result.action !== 'create') return;
    assert.equal(result.payload.categoryId, categoryId);
    assert.equal(result.payload.productType, type);
    assert.equal(result.payload.profitCondition, condition);
  });
});

test('falha de forma fechada para categoria comercial ausente ou ambigua', () => {
  const absent = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: { ...references, categories: [] },
  });
  const ambiguous = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [
        { id: 'category-a', name: 'iPhone Lacrado A', type: 'IPHONE_SEALED' },
        { id: 'category-b', name: 'iPhone Lacrado B', type: 'IPHONE_SEALED' },
      ],
    },
  });

  assert.equal(absent.action, 'incomplete');
  assert.equal(ambiguous.action, 'incomplete');
});

test('falha de forma fechada para Model com ProductType incompativel', () => {
  const incompatible = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: {
      ...references,
      models: [
        {
          id: 'model-cpo',
          categoryId: 'category-cpo',
          name: 'iPhone 17 Pro Max',
          productType: 'APPLE_CPO',
        },
      ],
    },
  });

  assert.equal(incompatible.action, 'incomplete');
  if (incompatible.action !== 'incomplete') return;
  assert.equal(incompatible.reason, 'INCOMPATIBLE_PRODUCT_TYPE');
});

test('cria Model canonico quando referencias fisicas convergem para o mesmo MacBook Neo', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: {
        ...item.product,
        name: 'MacBook Neo 8/256GB 13"',
        model: 'MacBook Neo',
        category: 'MacBook',
        capacity: '256GB',
        condition: 'CPO',
      },
      profit: { ...item.profit, productDescription: 'MacBook Neo 8/256GB 13"' },
    },
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-macbook', name: 'MacBook', type: 'MACBOOK' }],
      models: [
        {
          id: 'model-neo-256',
          categoryId: 'category-macbook',
          name: 'MacBook Neo A18 Pro 13" 8GB/256GB',
          productType: 'MACBOOK',
        },
        {
          id: 'model-neo-512',
          categoryId: 'category-macbook',
          name: 'MacBook Neo A18 Pro 13" 8GB/512GB',
          productType: 'MACBOOK',
        },
      ],
      storages: [{ id: 'storage-256', displayName: '256GB' }],
    },
  });

  assert.equal(result.action, 'create-model-and-product');
  if (result.action !== 'create-model-and-product') return;
  assert.deepEqual(result.model, {
    name: 'MacBook Neo 13"',
    canonicalModelKey: 'macbook-neo-13',
    productType: 'MACBOOK',
  });
  assert.equal(result.payload.productType, 'MACBOOK');
  assert.equal(result.payload.profitCondition, 'CPO');
});

test('mantem MacBook Neo sem screen em fail-closed', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: {
        ...item.product,
        name: 'MacBook Neo (6gpu/5gpu/8ram/256gb SSD)',
        model: 'MacBook Neo',
        category: 'MacBook',
        capacity: '256GB',
        condition: 'CPO',
      },
      profit: { ...item.profit, productDescription: 'MacBook Neo (6gpu/5gpu/8ram/256gb SSD)' },
    },
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-macbook', name: 'MacBook', type: 'MACBOOK' }],
      models: [
        {
          id: 'model-neo-13',
          categoryId: 'category-macbook',
          name: 'MacBook Neo A18 Pro 13" 8GB/256GB',
          productType: 'MACBOOK',
        },
      ],
    },
  });

  assert.equal(result.action, 'incomplete');
  if (result.action !== 'incomplete') return;
  assert.equal(result.reason, 'NO_CANONICAL_MODEL');
});

test('reutiliza a referencia cujo normalizedName ja e a chave canonica', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: {
        ...item.product,
        name: 'MacBook Neo 8/256GB 13"',
        model: 'MacBook Neo',
        category: 'MacBook',
        capacity: '256GB',
        condition: 'CPO',
      },
      profit: { ...item.profit, productDescription: 'MacBook Neo 8/256GB 13"' },
    },
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-macbook', name: 'MacBook', type: 'MACBOOK' }],
      models: [
        {
          id: 'model-neo-256',
          categoryId: 'category-macbook',
          name: 'MacBook Neo A18 Pro 13" 8GB/256GB',
          productType: 'MACBOOK',
        },
        {
          id: 'model-neo-512',
          categoryId: 'category-macbook',
          name: 'MacBook Neo A18 Pro 13" 8GB/512GB',
          productType: 'MACBOOK',
        },
        {
          id: 'model-neo-canonical',
          categoryId: 'category-macbook',
          name: 'MacBook Neo 13"',
          normalizedName: 'macbook-neo-13',
          productType: 'MACBOOK',
        },
      ],
      storages: [{ id: 'storage-256', displayName: '256GB' }],
    },
  });

  assert.equal(result.action, 'create');
  if (result.action !== 'create') return;
  assert.equal(result.payload.modelId, 'model-neo-canonical');
});

test('trata referencias fisicas equivalentes como uma identidade canonica em todas as familias', () => {
  const cases = [
    {
      name: 'iPhone 17 Pro Max 2TB',
      model: 'iPhone 17 Pro Max',
      category: 'iPhone',
      type: 'IPHONE_SEALED',
    },
    { name: 'iPad 11 A16 256GB', model: 'iPad 11', category: 'iPad', type: 'IPAD' },
    {
      name: 'MacBook Air M4 13" 16GB 256GB',
      model: 'MacBook Air M4 13"',
      category: 'MacBook',
      type: 'MACBOOK',
    },
    {
      name: 'Apple Watch Series 11 46mm GPS',
      model: 'Apple Watch Series 11 46mm',
      category: 'Apple Watch',
      type: 'APPLE_WATCH',
    },
    { name: 'AirPods 4', model: 'AirPods 4', category: 'Acessorios', type: 'AIRPODS' },
    {
      name: 'Apple Pencil USB-C',
      model: 'Apple Pencil USB-C',
      category: 'Acessorios',
      type: 'ACCESSORY',
    },
  ];

  cases.forEach(({ name, model, category, type }) => {
    const result = resolveProfitRegistration({
      item: {
        ...item,
        product: { ...item.product, name, model, category },
        profit: { ...item.profit, productDescription: name },
      },
      netProfit: '500',
      products: [],
      references: {
        ...references,
        categories: [{ id: `category-${type}`, name: 'Categoria comercial', type }],
        models: [
          { id: `model-${type}-a`, categoryId: `category-${type}`, name: model, productType: type },
          { id: `model-${type}-b`, categoryId: `category-${type}`, name: model, productType: type },
        ],
      },
    });

    assert.equal(result.action, 'create-model-and-product', name);
    if (result.action !== 'create-model-and-product') return;
    assert.equal(result.model.productType, type, name);
    assert.equal(result.payload.productType, type, name);
  });
});

test('bloqueia referencias canonicas com tipos comerciais divergentes', () => {
  const result = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [
        { id: 'category-sealed', name: 'iPhone Lacrado', type: 'IPHONE_SEALED' },
        { id: 'category-cpo', name: 'Apple CPO', type: 'APPLE_CPO' },
      ],
      models: [
        {
          id: 'model-sealed',
          categoryId: 'category-sealed',
          name: 'iPhone 17 Pro Max',
          productType: 'IPHONE_SEALED',
        },
        {
          id: 'model-cpo',
          categoryId: 'category-cpo',
          name: 'iPhone 17 Pro Max',
          productType: 'APPLE_CPO',
        },
      ],
    },
  });

  assert.equal(result.action, 'incomplete');
  if (result.action !== 'incomplete') return;
  assert.equal(result.reason, 'INCOMPATIBLE_PRODUCT_TYPE');
});

test('falha de forma fechada para Category ausente, tipo divergente ou desconhecido', () => {
  const categoryAbsent = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: { ...references, categories: [] },
  });
  const typeDivergent = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-iphone', name: 'iPhone', type: 'IPAD' }],
    },
  });
  const typeUnknown = resolveProfitRegistration({
    item,
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-iphone', name: 'Categoria', type: 'UNKNOWN' }],
      models: [
        {
          id: 'model-17-pro-max',
          categoryId: 'category-iphone',
          name: 'iPhone 17 Pro Max',
          productType: 'UNKNOWN',
        },
      ],
    },
  });

  assert.equal(categoryAbsent.action, 'incomplete');
  assert.equal(typeDivergent.action, 'incomplete');
  assert.equal(typeUnknown.action, 'incomplete');
});

test('aplica a mesma ponte estrutural para MacBook, iPad e Apple Watch', () => {
  const cases = [
    {
      name: 'MacBook Air M4 13 256GB',
      model: 'MacBook Air M4 13"',
      category: 'MacBook',
      type: 'MACBOOK',
    },
    {
      name: 'iPad 11 A16 256GB',
      model: 'iPad 11',
      category: 'iPad',
      type: 'IPAD',
    },
    {
      name: 'Apple Watch Series 11 46mm GPS',
      model: 'Apple Watch Series 11 46mm',
      category: 'Apple Watch',
      type: 'APPLE_WATCH',
    },
  ];

  cases.forEach(({ name, model, category, type }) => {
    const result = resolveProfitRegistration({
      item: {
        ...item,
        product: { ...item.product, name, model, category },
        profit: { ...item.profit, productDescription: name },
      },
      netProfit: '500',
      products: [],
      references: {
        ...references,
        categories: [{ id: `category-${type}`, name: 'Categoria comercial', type }],
        models: [
          { id: `model-${type}`, categoryId: `category-${type}`, name: model, productType: type },
        ],
      },
    });

    assert.equal(result.action, 'create');
    if (result.action !== 'create') return;
    assert.equal(result.payload.categoryId, `category-${type}`);
    assert.equal(result.payload.productType, type);
  });
});

test('resolve AirPods e acessorio verdadeiro pelo tipo estruturado do catalogo', () => {
  const cases = [
    { name: 'AirPods 4', model: 'AirPods 4', type: 'AIRPODS' },
    { name: 'AirPods Pro 3', model: 'AirPods Pro 3', type: 'AIRPODS' },
    { name: 'AirPods Max', model: 'AirPods Max', type: 'AIRPODS' },
    { name: 'Apple Pencil USB-C', model: 'Apple Pencil USB-C', type: 'ACCESSORY' },
  ];

  cases.forEach(({ name, model, type }) => {
    const result = resolveProfitRegistration({
      item: {
        ...item,
        product: { ...item.product, name, model, category: 'Acessorios' },
        profit: { ...item.profit, productDescription: name },
      },
      netProfit: '500',
      products: [],
      references: {
        ...references,
        categories: [{ id: `category-${type}`, name: 'Categoria comercial', type }],
        models: [
          { id: `model-${type}`, categoryId: `category-${type}`, name: model, productType: type },
        ],
      },
    });

    assert.equal(result.action, 'create');
    if (result.action !== 'create') return;
    assert.equal(result.payload.productType, type);
  });
});

test('categoria textual desconhecida nao usa ACCESSORY como fallback', () => {
  const result = resolveProfitRegistration({
    item: {
      ...item,
      product: {
        ...item.product,
        name: 'AirPods Max',
        model: 'AirPods Max',
        category: 'Categoria desconhecida',
      },
      profit: { ...item.profit, productDescription: 'AirPods Max' },
    },
    netProfit: '500',
    products: [],
    references: {
      ...references,
      categories: [{ id: 'category-airpods', name: 'AirPods', type: 'AIRPODS' }],
      models: [
        {
          id: 'model-airpods-max',
          categoryId: 'category-airpods',
          name: 'AirPods Max',
          productType: 'AIRPODS',
        },
      ],
    },
  });

  assert.equal(result.action, 'create');
  if (result.action !== 'create') return;
  assert.equal(result.payload.productType, 'AIRPODS');
});
