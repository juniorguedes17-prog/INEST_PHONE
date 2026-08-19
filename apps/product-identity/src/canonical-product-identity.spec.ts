import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
} from './canonical-product-identity';

test('preserva a identidade homologada de iPhone Pro Max', () => {
  const result = normalizeCanonicalProductIdentity({
    productName: 'IPH 17PM 256GB Deep Blue NOVO',
  });

  assert.deepEqual(result, {
    canonicalCategory: 'iPhone',
    canonicalModelKey: 'iphone-17-pro-max',
    canonicalModelLabel: 'iPhone 17 Pro Max',
    canonicalModelMatched: true,
    canonicalModelConfidence: 0.95,
    canonicalModelMatchMethod: 'deterministic',
    canonicalCondition: 'Novo',
    canonicalRam: null,
    canonicalStorage: '256GB',
    canonicalColor: 'azul-profundo',
    canonicalScreen: null,
    canonicalScreenSource: 'unknown',
    canonicalConnectivity: null,
    canonicalConnectivitySource: 'unknown',
    canonicalChip: null,
  });
});

test('preserva RAM, armazenamento, tela e chip de MacBook', () => {
  const result = normalizeCanonicalProductIdentity({
    productName: 'MacBook Air M5 13inch 16GB 512GB Midnight',
    quality: 'SEMINOVO',
  });

  assert.deepEqual(result, {
    canonicalCategory: 'MacBook',
    canonicalModelKey: 'macbook-air-m5-13',
    canonicalModelLabel: 'MacBook Air M5 13"',
    canonicalModelMatched: true,
    canonicalModelConfidence: 0.95,
    canonicalModelMatchMethod: 'deterministic',
    canonicalCondition: 'Seminovo',
    canonicalRam: '16GB',
    canonicalStorage: '512GB',
    canonicalColor: 'preto',
    canonicalScreen: '13"',
    canonicalScreenSource: 'explicit',
    canonicalConnectivity: null,
    canonicalConnectivitySource: 'unknown',
    canonicalChip: 'M5',
  });
});

test('converge o MacBook Neo 13 e aplica invariantes canônicas do modelo', () => {
  const supplier = normalizeCanonicalProductIdentity(
    'MacBook Neo (A18) Pro 13" 8/256GB',
  );
  const catalog = normalizeCanonicalProductIdentity('MacBook Neo (13”) 8/256GB');

  assert.equal(supplier.canonicalModelKey, 'macbook-neo-13');
  assert.equal(catalog.canonicalModelKey, 'macbook-neo-13');
  assert.equal(supplier.canonicalChip, 'A18 Pro');
  assert.equal(catalog.canonicalChip, 'A18 Pro');
  assert.equal(supplier.canonicalScreen, '13"');
  assert.equal(catalog.canonicalScreen, '13"');
});

test('preserva tamanho e conectividade de Apple Watch', () => {
  const result = normalizeCanonicalProductIdentity({
    productName: 'Apple Watch S11 46mm GPS + Cellular Silver',
    quality: 'CPO',
  });

  assert.deepEqual(result, {
    canonicalCategory: 'Apple Watch',
    canonicalModelKey: 'apple-watch-series-11-46',
    canonicalModelLabel: 'Apple Watch Series 11 46mm',
    canonicalModelMatched: true,
    canonicalModelConfidence: 1,
    canonicalModelMatchMethod: 'exact_alias',
    canonicalCondition: 'CPO',
    canonicalRam: null,
    canonicalStorage: null,
    canonicalColor: 'prata',
    canonicalScreen: '46mm',
    canonicalScreenSource: 'explicit',
    canonicalConnectivity: 'GPS + Cellular',
    canonicalConnectivitySource: 'explicit',
    canonicalChip: null,
  });
});

test('preserva o comportamento fail-closed para produto desconhecido', () => {
  const result = normalizeCanonicalProductIdentity('Produto XYZ Pro 512GB');

  assert.equal(result.canonicalCategory, 'Eletronicos');
  assert.equal(result.canonicalModelKey, '');
  assert.equal(result.canonicalModelLabel, '');
  assert.equal(result.canonicalModelMatched, false);
  assert.equal(result.canonicalModelConfidence, 0);
  assert.equal(result.canonicalModelMatchMethod, 'unclassified');
  assert.equal(result.canonicalStorage, '512GB');
  assert.equal(result.canonicalScreenSource, 'unknown');
  assert.equal(result.canonicalConnectivitySource, 'unknown');
});

test('preserva a normalizacao textual pura', () => {
  assert.equal(
    normalizeCanonicalText('  📱 iPhone 17 Pro-Max  256 GB  '),
    'iphone 17 pro max 256 gb',
  );
});
