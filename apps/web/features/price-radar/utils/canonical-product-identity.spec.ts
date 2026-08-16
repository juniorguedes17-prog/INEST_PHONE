import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCanonicalModelFacetOptions } from './brazil-radar-facets';
import { normalizeCanonicalProductIdentity } from './canonical-product-identity';

function identity(productName: string) {
  return normalizeCanonicalProductIdentity({ productName });
}

test('consolida aliases de iPhone em uma identidade unica', () => {
  const inputs = ['IPH 17PM', 'iPhone17 ProMax', 'iphone 17 pro max'];
  const identities = inputs.map(identity);

  assert.deepEqual(identities.map((item) => item.canonicalModelLabel), [
    'iPhone 17 Pro Max',
    'iPhone 17 Pro Max',
    'iPhone 17 Pro Max',
  ]);
  assert.equal(new Set(identities.map((item) => item.canonicalModelKey)).size, 1);
});

test('separa modelo, RAM, armazenamento e tela de MacBook', () => {
  const inputs = [
    'Mac Air M5 13 16/512',
    'MacBook Air M5 13inch 16GB 512GB',
  ];
  const identities = inputs.map(identity);

  identities.forEach((item) => {
    assert.equal(item.canonicalModelLabel, 'MacBook Air M5 13"');
    assert.equal(item.canonicalRam, '16GB');
    assert.equal(item.canonicalStorage, '512GB');
    assert.equal(item.canonicalScreen, '13"');
  });
});

test('consolida aliases de Apple Watch e separa conectividade', () => {
  const inputs = ['S11 46', 'Series 11 46mm', 'Apple Watch S11 46mm'];
  const identities = inputs.map(identity);

  identities.forEach((item) => {
    assert.equal(item.canonicalModelLabel, 'Apple Watch Series 11 46mm');
  });

  const noisy = identity('OFERTA APPLE WATCH S11 46MM GPS R$ 1.990');
  assert.equal(noisy.canonicalModelLabel, 'Apple Watch Series 11 46mm');
  assert.equal(noisy.canonicalConnectivity, 'GPS');
});

test('consolida iPad e acessorios por aliases deterministas', () => {
  assert.equal(identity('iPad Air M4 13').canonicalModelKey, identity('iPad Air M4 13"').canonicalModelKey);
  assert.equal(identity('Apple Pencil Pro').canonicalModelKey, identity('Pencil Pro').canonicalModelKey);
});

test('mantem produto desconhecido sem forcar correspondencia Apple', () => {
  const unknown = identity('Produto XYZ Pro 512GB');

  assert.equal(unknown.canonicalModelLabel, 'Produto Xyz Pro');
  assert.equal(unknown.canonicalModelKey, 'produto-xyz-pro');
  assert.equal(unknown.canonicalStorage, '512GB');
  assert.equal(unknown.canonicalCategory, 'Eletronicos');
});

test('nao transforma data isolada em opcao de modelo', () => {
  const date = identity('15 08 2026');

  assert.equal(date.canonicalModelLabel, '');
  assert.equal(date.canonicalModelKey, '');
});

test('agrega a contagem de grafias equivalentes pelo canonicalModelKey', () => {
  const facets = buildCanonicalModelFacetOptions([
    { productName: 'IPH 17PM' },
    { productName: 'iPhone17 ProMax' },
    { productName: 'iphone 17 pro max' },
    { productName: 'Apple Pencil Pro' },
  ]);

  assert.deepEqual(facets, [
    { value: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', count: 3 },
    { value: 'apple-pencil-pro', label: 'Apple Pencil Pro', count: 1 },
  ]);
});
