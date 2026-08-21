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

test('normaliza RAM quando o marcador precede a capacidade', () => {
  const result = normalizeCanonicalProductIdentity('MacBook Air M5 13" RAM 8GB 256GB');

  assert.equal(result.canonicalRam, '8GB');
  assert.equal(result.canonicalStorage, '256GB');
});

test('completa invariantes seguras de MacBook Air e Pro', () => {
  const air = normalizeCanonicalProductIdentity('MacBook Air M5 13" 16G 512');
  const pro = normalizeCanonicalProductIdentity('MacBook Pro M5 Pro 16" 24G 1TB');

  assert.deepEqual(
    [air.canonicalModelKey, air.canonicalChip, air.canonicalScreen, air.canonicalRam, air.canonicalStorage],
    ['macbook-air-m5-13', 'M5', '13"', '16GB', '512GB'],
  );
  assert.deepEqual(
    [pro.canonicalModelKey, pro.canonicalChip, pro.canonicalScreen, pro.canonicalRam, pro.canonicalStorage],
    ['macbook-pro-m5-pro-16', 'M5 Pro', '16"', '24GB', '1TB'],
  );
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

test('enriquece memoria abreviada de MacBook somente em pares inequívocos', () => {
  const cases = [
    ['MacBook Neo 13" 8G 256', '8GB', '256GB'],
    ['MacBook Neo 13" 8G 512', '8GB', '512GB'],
    ['MacBook Neo 13" 16G 256', '16GB', '256GB'],
    ['MacBook Neo 13" 16 512', '16GB', '512GB'],
    ['MacBook Neo 13" 24 1TB', '24GB', '1TB'],
  ] as const;

  for (const [description, ram, storage] of cases) {
    const result = normalizeCanonicalProductIdentity(description);
    assert.equal(result.canonicalModelKey, 'macbook-neo-13');
    assert.equal(result.canonicalRam, ram);
    assert.equal(result.canonicalStorage, storage);
    assert.equal(result.canonicalChip, 'A18 Pro');
  }

  const ambiguous = normalizeCanonicalProductIdentity('MacBook Neo 13" 12 512');
  assert.equal(ambiguous.canonicalRam, null);
  assert.equal(ambiguous.canonicalStorage, null);
});

test('resolve tela explícita de MacBook independentemente da posição dos atributos', () => {
  const before = normalizeCanonicalProductIdentity('MacBook Neo 13" 8/256GB');
  const afterStraightQuotes = normalizeCanonicalProductIdentity('MacBook Neo 8/256GB 13"');
  const afterCurvedQuotes = normalizeCanonicalProductIdentity(
    'MacBook Neo A18 Pro 8GB / 256GB 13”',
  );
  const alternateFamilyAlias = normalizeCanonicalProductIdentity('Mac Neo 8/256GB 13"');
  const otherModel = normalizeCanonicalProductIdentity('MacBook Air M5 16/512GB 13"');

  assert.deepEqual([before.canonicalModelKey, before.canonicalScreen], ['macbook-neo-13', '13"']);
  assert.deepEqual(
    [afterStraightQuotes.canonicalModelKey, afterStraightQuotes.canonicalScreen],
    ['macbook-neo-13', '13"'],
  );
  assert.deepEqual(
    [afterCurvedQuotes.canonicalModelKey, afterCurvedQuotes.canonicalScreen],
    ['macbook-neo-13', '13"'],
  );
  assert.deepEqual(
    [alternateFamilyAlias.canonicalModelKey, alternateFamilyAlias.canonicalScreen],
    ['macbook-neo-13', '13"'],
  );
  assert.deepEqual(
    [otherModel.canonicalModelKey, otherModel.canonicalScreen],
    ['macbook-air-m5-13', '13"'],
  );
});

test('não inventa tela quando a descrição do MacBook não informa screen', () => {
  const result = normalizeCanonicalProductIdentity('MacBook Neo 8/512');

  assert.equal(result.canonicalScreen, null);
  assert.equal(result.canonicalScreenSource, 'unknown');
  assert.notEqual(result.canonicalModelKey, 'macbook-neo-13');
});

test('completa conectividade iPad no nível da família e preserva Cellular explícito', () => {
  const wifi = normalizeCanonicalProductIdentity('iPad 11 128GB');
  const wifiComplete = normalizeCanonicalProductIdentity('iPad 11 A16 128GB 11" Wi-Fi');
  const cellular = normalizeCanonicalProductIdentity('iPad 11 128GB Cellular');
  const wifiCellular = normalizeCanonicalProductIdentity('iPad Air M4 11 128GB WiFi/Cellular');
  const air = normalizeCanonicalProductIdentity('iPad Air M4 11 128GB');
  const pro = normalizeCanonicalProductIdentity('iPad Pro M5 13 256GB Cellular');

  assert.deepEqual(
    [wifi.canonicalModelKey, wifi.canonicalChip, wifi.canonicalScreen, wifi.canonicalConnectivity],
    ['ipad-11', 'A16', '11"', 'Wi-Fi'],
  );
  assert.equal(wifi.canonicalConnectivitySource, 'safe_default');
  assert.deepEqual(
    [wifiComplete.canonicalChip, wifiComplete.canonicalScreen, wifiComplete.canonicalConnectivity],
    ['A16', '11"', 'Wi-Fi'],
  );
  assert.equal(cellular.canonicalConnectivity, 'Wi-Fi + Cellular');
  assert.equal(wifiCellular.canonicalConnectivity, 'Wi-Fi + Cellular');
  assert.deepEqual(
    [air.canonicalModelKey, air.canonicalChip, air.canonicalScreen, air.canonicalConnectivity],
    ['ipad-air-m4-11', 'M4', '11"', 'Wi-Fi'],
  );
  assert.deepEqual(
    [pro.canonicalModelKey, pro.canonicalChip, pro.canonicalScreen, pro.canonicalConnectivity],
    ['ipad-pro-m5-13', 'M5', '13"', 'Wi-Fi + Cellular'],
  );
});

test('aplica GPS por default para Apple Watch e preserva a precedência de Cellular', () => {
  const absent = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm');
  const gps = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm GPS');
  const cellular = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm Cellular');
  const gpsCellular = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm GPS + Cellular');
  const slashCellular = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm GPS/Cellular');
  const portugueseCellular = normalizeCanonicalProductIdentity('Apple Watch SE 3 44mm com celular');

  assert.equal(absent.canonicalConnectivity, 'GPS');
  assert.equal(absent.canonicalConnectivitySource, 'safe_default');
  assert.equal(gps.canonicalConnectivity, 'GPS');
  assert.equal(cellular.canonicalConnectivity, 'GPS + Cellular');
  assert.equal(gpsCellular.canonicalConnectivity, 'GPS + Cellular');
  assert.equal(slashCellular.canonicalConnectivity, 'GPS + Cellular');
  assert.equal(portugueseCellular.canonicalConnectivity, 'GPS + Cellular');
});

test('falha fechada quando atributo explícito contradiz invariant do modelo', () => {
  const valid = normalizeCanonicalProductIdentity('iPad 11 A16 128GB 11"');
  const conflict = normalizeCanonicalProductIdentity('iPad 11 A16 128GB 12"');

  assert.equal(valid.canonicalModelKey, 'ipad-11');
  assert.equal(valid.canonicalModelMatched, true);
  assert.equal(conflict.canonicalModelKey, '');
  assert.equal(conflict.canonicalModelMatched, false);
});

test('não interpreta pares numéricos abreviados fora de MacBook', () => {
  const iphone = normalizeCanonicalProductIdentity('iPhone 17 16 512');
  const compactIphone = normalizeCanonicalProductIdentity('iPhone 17 8/256GB');

  assert.equal(iphone.canonicalRam, null);
  assert.equal(iphone.canonicalStorage, null);
  assert.equal(compactIphone.canonicalRam, null);
  assert.equal(compactIphone.canonicalStorage, null);
});

test('falha fechada para atributos de memoria conflitantes', () => {
  const conflictingMac = normalizeCanonicalProductIdentity('MacBook Neo 13" 8/256GB 16/512GB');
  const conflictingStorage = normalizeCanonicalProductIdentity('iPhone 17 Pro 256GB 512GB');

  assert.equal(conflictingMac.canonicalRam, null);
  assert.equal(conflictingMac.canonicalStorage, null);
  assert.equal(conflictingStorage.canonicalStorage, null);
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
