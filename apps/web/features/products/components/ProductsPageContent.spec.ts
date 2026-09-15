import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildInitialProductForm,
  buildProductSaveRequest,
  changeProductCategory,
} from './ProductsPageContent';
import { ProductFormPayload, ProductItem, ProductReferences } from '../types/products';

const references: ProductReferences = {
  categories: [
    { id: 'category-a', name: 'iPhone Lacrado', type: 'IPHONE_SEALED' },
    { id: 'category-b', name: 'MacBook', type: 'MACBOOK' },
  ],
  models: [
    { id: 'model-a', name: 'iPhone 17 Pro Max', categoryId: 'category-a' },
    { id: 'model-b', name: 'MacBook Air', categoryId: 'category-b' },
  ],
  colors: [],
  storages: [],
};

const form: ProductFormPayload = {
  categoryId: 'category-a',
  modelId: '',
  colorId: '',
  storageId: 'storage-256',
  productType: 'IPHONE_SEALED',
  status: 'ACTIVE',
  productDescription: 'iPhone 18 Pro Max',
  profitCondition: 'NOVO',
  netProfit: '590',
};

test('new product starts without selecting the first model', () => {
  const initial = buildInitialProductForm(null, references);

  assert.equal(initial.categoryId, 'category-a');
  assert.equal(initial.modelId, '');
  assert.equal(initial.productType, 'IPHONE_SEALED');
});

test('existing model requires an explicit model and keeps the current create payload', () => {
  const result = buildProductSaveRequest({
    form: { ...form, modelId: 'model-a' },
    modelMode: 'existing',
    newModelName: '',
  });

  assert.deepEqual(result.request, {
    modelMode: 'existing',
    payload: { ...form, modelId: 'model-a', colorId: undefined },
    id: undefined,
  });
});

test('new model trims the explicit name and does not manufacture a model id', () => {
  const result = buildProductSaveRequest({
    form,
    modelMode: 'new',
    newModelName: '  iPhone 18 Pro Max  ',
  });

  assert.deepEqual(result.request, {
    modelMode: 'new',
    payload: { ...form, colorId: undefined },
    modelName: 'iPhone 18 Pro Max',
  });
});

test('empty new model name blocks submission', () => {
  const result = buildProductSaveRequest({
    form,
    modelMode: 'new',
    newModelName: '   ',
  });

  assert.equal(result.request, undefined);
  assert.equal(result.error, 'Informe o nome do novo modelo.');
});

test('missing existing model blocks submission', () => {
  const result = buildProductSaveRequest({
    form,
    modelMode: 'existing',
    newModelName: '',
  });

  assert.equal(result.request, undefined);
  assert.equal(result.error, 'Selecione um modelo existente ou escolha Novo modelo.');
});

test('category change clears an incompatible model without selecting a fallback', () => {
  const changed = changeProductCategory(
    { ...form, modelId: 'model-a' },
    'category-b',
    references.models,
    references.categories,
  );

  assert.equal(changed.categoryId, 'category-b');
  assert.equal(changed.modelId, '');
  assert.equal(changed.productType, 'MACBOOK');
});

test('editing preserves the existing product model', () => {
  const product: ProductItem = {
    id: 'product-a',
    categoryId: 'category-a',
    modelId: 'model-a',
    productType: 'IPHONE_SEALED',
    status: 'ACTIVE',
    productDescription: 'iPhone 17 Pro Max',
    profitCondition: 'NOVO',
    netProfit: 590,
  };

  const initial = buildInitialProductForm(product, references);

  assert.equal(initial.modelId, 'model-a');
  assert.equal(initial.productType, 'IPHONE_SEALED');
});
