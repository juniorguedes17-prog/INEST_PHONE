import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNewModelProfitRegistrationPayload, persistProduct } from './useProducts';
import { ProductFormPayload, ProductItem } from '../types/products';

const product: ProductFormPayload = {
  categoryId: 'category-a',
  modelId: '',
  colorId: undefined,
  storageId: 'storage-256',
  productType: 'IPHONE_SEALED',
  isAppleOriginal: true,
  status: 'ACTIVE',
  productDescription: 'iPhone 18 Pro Max',
  profitCondition: 'NOVO',
  netProfit: '590',
};

const createdProduct: ProductItem = {
  id: 'product-18',
  categoryId: 'category-a',
  modelId: 'model-18',
  productType: 'IPHONE_SEALED',
  status: 'ACTIVE',
};

test('existing model uses only the existing product endpoint', async () => {
  const calls: string[] = [];

  await persistProduct(
    { modelMode: 'existing', payload: { ...product, modelId: 'model-17' } },
    {
      createProduct: async () => {
        calls.push('createProduct');
        return createdProduct;
      },
      createProfitRegistration: async () => {
        calls.push('createProfitRegistration');
        return createdProduct;
      },
      updateProduct: async () => {
        calls.push('updateProduct');
        return createdProduct;
      },
    },
  );

  assert.deepEqual(calls, ['createProduct']);
});

test('new model uses the atomic H1 endpoint without frontend-owned keys', async () => {
  let captured: unknown;
  const payload = buildNewModelProfitRegistrationPayload(product, '  iPhone 18 Pro Max  ');

  await persistProduct(
    { modelMode: 'new', payload: product, modelName: 'iPhone 18 Pro Max' },
    {
      createProduct: async () => {
        assert.fail('existing product endpoint must not be called');
      },
      createProfitRegistration: async (request) => {
        captured = request;
        return createdProduct;
      },
      updateProduct: async () => {
        assert.fail('update endpoint must not be called');
      },
    },
  );

  assert.deepEqual(captured, payload);
  assert.equal(payload.model.name, 'iPhone 18 Pro Max');
  assert.equal(payload.model.productType, 'IPHONE_SEALED');
  assert.equal('canonicalModelKey' in payload.model, false);
  assert.equal('normalizedName' in payload.model, false);
  assert.equal('modelId' in payload.product, false);
  assert.equal(payload.product.isAppleOriginal, true);
});

test('new model preserves an explicit Non-Apple classification', () => {
  const payload = buildNewModelProfitRegistrationPayload(
    { ...product, isAppleOriginal: false },
    'Produto novo',
  );

  assert.equal(payload.product.isAppleOriginal, false);
});

test('backend conflict is surfaced without falling back to an existing model', async () => {
  let existingCalls = 0;
  const conflict = new Error('Modelo ja existe no escopo cadastral informado.');

  await assert.rejects(
    persistProduct(
      { modelMode: 'new', payload: product, modelName: 'IPHONE 18 PRO MAX' },
      {
        createProduct: async () => {
          existingCalls += 1;
          return createdProduct;
        },
        createProfitRegistration: async () => {
          throw conflict;
        },
        updateProduct: async () => {
          assert.fail('update endpoint must not be called');
        },
      },
    ),
    conflict,
  );
  assert.equal(existingCalls, 0);
});

test('editing preserves the update endpoint and existing model id', async () => {
  const calls: Array<{ id: string; modelId: string }> = [];

  await persistProduct(
    {
      modelMode: 'existing',
      payload: { ...product, modelId: 'model-17' },
      id: 'product-17',
    },
    {
      createProduct: async () => {
        assert.fail('create endpoint must not be called');
      },
      createProfitRegistration: async () => {
        assert.fail('atomic create endpoint must not be called');
      },
      updateProduct: async (id, payload) => {
        calls.push({ id, modelId: payload.modelId });
        return createdProduct;
      },
    },
  );

  assert.deepEqual(calls, [{ id: 'product-17', modelId: 'model-17' }]);
});
