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
  isAppleOriginal: true,
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
  assert.equal(initial.isAppleOriginal, undefined);
});

test('new product requires an explicit financial classification', () => {
  const result = buildProductSaveRequest({
    form: { ...form, modelId: 'model-a', isAppleOriginal: undefined },
    modelMode: 'existing',
    newModelName: '',
  });

  assert.equal(result.request, undefined);
  assert.equal(result.error, 'Selecione a classificacao financeira do produto.');
});

test('new Product sends the explicit Apple classification', () => {
  const result = buildProductSaveRequest({
    form: { ...form, modelId: 'model-a', isAppleOriginal: true },
    modelMode: 'existing',
    newModelName: '',
  });

  assert.equal(result.request?.payload.isAppleOriginal, true);
});

test('new Product sends the explicit Non-Apple classification', () => {
  const result = buildProductSaveRequest({
    form: { ...form, modelId: 'model-a', isAppleOriginal: false },
    modelMode: 'existing',
    newModelName: '',
  });

  assert.equal(result.request?.payload.isAppleOriginal, false);
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

test('editing presents true, false and null financial classifications without inference', () => {
  assert.equal(
    buildInitialProductForm({ ...productForEdit(true), isAppleOriginal: true }, references)
      .isAppleOriginal,
    true,
  );
  assert.equal(
    buildInitialProductForm({ ...productForEdit(false), isAppleOriginal: false }, references)
      .isAppleOriginal,
    false,
  );
  const unclassified = buildInitialProductForm(
    { ...productForEdit(null), isAppleOriginal: null },
    references,
  );
  assert.equal(unclassified.isAppleOriginal, undefined);
  assert.equal(
    buildProductSaveRequest({
      form: unclassified,
      modelMode: 'existing',
      newModelName: '',
      productId: unclassified.modelId,
    }).request,
    undefined,
  );
});

function productForEdit(isAppleOriginal: boolean | null): ProductItem {
  return {
    id: 'product-a',
    categoryId: 'category-a',
    modelId: 'model-a',
    productType: 'IPHONE_SEALED',
    isAppleOriginal,
    status: 'ACTIVE',
    productDescription: 'Produto cadastrado',
    profitCondition: 'NOVO',
    netProfit: 590,
  };
}
