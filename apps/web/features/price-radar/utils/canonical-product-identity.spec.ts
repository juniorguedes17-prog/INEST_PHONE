import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areBrazilRadarFacetStatesEqual,
  buildBrazilRadarFacets,
  buildCanonicalModelFacetOptions,
  emptyBrazilRadarFacetState,
  filterBrazilRadarQuotes,
  normalizeBrazilRadarFacetState,
} from './brazil-radar-facets';
import { PriceQuoteItem } from '../types/price-radar';
import { normalizeCanonicalProductIdentity } from './canonical-product-identity';

function identity(productName: string) {
  return normalizeCanonicalProductIdentity({ productName });
}

test('consolida aliases de iPhone em uma identidade unica', () => {
  const inputs = ['IPH 17PM', 'iPhone17 ProMax', 'iphone 17 pro max'];
  const identities = inputs.map(identity);

  assert.deepEqual(
    identities.map((item) => item.canonicalModelLabel),
    ['iPhone 17 Pro Max', 'iPhone 17 Pro Max', 'iPhone 17 Pro Max'],
  );
  assert.equal(new Set(identities.map((item) => item.canonicalModelKey)).size, 1);
  assert.ok(identities.every((item) => item.canonicalModelMatched));
  assert.ok(identities.every((item) => item.canonicalModelConfidence >= 0.95));
});

test('separa modelo, RAM, armazenamento e tela de MacBook', () => {
  const inputs = ['Mac Air M5 13 16/512', 'MacBook Air M5 13inch 16GB 512GB'];
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
  assert.equal(
    identity('iPad Air M4 13').canonicalModelKey,
    identity('iPad Air M4 13"').canonicalModelKey,
  );
  assert.equal(
    identity('Apple Pencil Pro').canonicalModelKey,
    identity('Pencil Pro').canonicalModelKey,
  );
  assert.equal(
    identity('Magic Keyboard com teclado numerico').canonicalModelLabel,
    'Magic Keyboard',
  );
});

test('mantem produto desconhecido sem forcar correspondencia Apple', () => {
  const unknown = identity('Produto XYZ Pro 512GB');

  assert.equal(unknown.canonicalModelLabel, '');
  assert.equal(unknown.canonicalModelKey, '');
  assert.equal(unknown.canonicalModelMatched, false);
  assert.equal(unknown.canonicalModelConfidence, 0);
  assert.equal(unknown.canonicalModelMatchMethod, 'unclassified');
  assert.equal(unknown.canonicalStorage, '512GB');
  assert.equal(unknown.canonicalCategory, 'Eletronicos');
});

test('nao transforma data isolada em opcao de modelo', () => {
  const date = identity('15 08 2026');

  assert.equal(date.canonicalModelLabel, '');
  assert.equal(date.canonicalModelKey, '');
});

test('agrega a contagem de grafias equivalentes pelo canonicalModelKey', () => {
  const items = [
    ...Array.from({ length: 3 }, () => ({ productName: 'IPH 17PM' })),
    ...Array.from({ length: 2 }, () => ({ productName: 'iPhone17 ProMax' })),
    ...Array.from({ length: 5 }, () => ({ productName: 'iPhone 17 Pro Max' })),
  ];
  const facets = buildCanonicalModelFacetOptions(items);

  assert.deepEqual(facets, [{ value: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', count: 10 }]);
});

test('corpus de regressao nao transforma residuos em modelos', () => {
  const invalidModels = [
    'Apple Watch Cabo Lightning 2m Apple Watch Apple Watch Cabo Lightning 2m Apple',
    'Assis Nunca Active',
    'Cabo Carregador Para Apple Watch Ano Garantia Apple Watch Cabo Carregador Para Apple Watch Ano Garantia',
    'Cabo Usb-c / Usb-c Original',
    'iPhone Cabo Tipo-c Padrao iPhone Cabo Tipo-c Padrao',
    'iPhone Cabo Usbc. Padrao iPhone Cabo Usbc. Padrao',
    'iPhone s11 iPhone s11',
    'Promax',
    'Imac M4 24" 16ram Imac Imac M4 24" 16ram',
    'Imac M4 24" 24ram Imac Imac M4 24" 24ram',
  ];

  invalidModels.forEach((productName) => {
    const result = identity(productName);
    assert.equal(result.canonicalModelMatched, false, productName);
    assert.equal(result.canonicalModelKey, '', productName);
    assert.equal(result.canonicalModelLabel, '', productName);
  });

  assert.deepEqual(
    buildCanonicalModelFacetOptions(invalidModels.map((productName) => ({ productName }))),
    [],
  );
});

test('normaliza acessorio somente quando existe regra segura no registry', () => {
  const inputs = [
    'Apple Airtag 1pack Acessorio Apple Airtag 1pack',
    'Apple Airtag 4pack Acessorio Apple Airtag 4pack',
  ];
  const facets = buildCanonicalModelFacetOptions(inputs.map((productName) => ({ productName })));

  assert.deepEqual(facets, [{ value: 'airtag', label: 'AirTag', count: 2 }]);
});

test('mantem produto desconhecido no dataset sem contaminar o facet Modelo', () => {
  const items = [
    { id: 'known', productName: 'iPhone 17 Pro Max 256GB' },
    { id: 'unknown', productName: 'Produto XYZ Pro 512GB' },
    { id: 'noise', productName: 'Assis Nunca Active' },
  ];
  const facets = buildCanonicalModelFacetOptions(items);

  assert.equal(items.length, 3);
  assert.ok(items.some((item) => item.id === 'unknown'));
  assert.deepEqual(facets, [{ value: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', count: 1 }]);
});

test('nao forca modelo quando o texto contem categorias conflitantes', () => {
  const conflict = identity('iPhone 17 Pro Max Apple Watch S11 46mm');

  assert.equal(conflict.canonicalModelMatched, false);
  assert.equal(conflict.canonicalModelMatchMethod, 'unclassified');
});

function quote(values: Partial<PriceQuoteItem>): PriceQuoteItem {
  return {
    id: values.id ?? crypto.randomUUID(),
    productId: values.productId ?? null,
    supplierId: values.supplierId ?? 'supplier',
    productName: values.productName ?? '',
    category: values.category ?? '',
    model: values.model ?? '',
    color: values.color ?? '',
    capacity: values.capacity ?? '',
    productType: values.productType ?? '',
    quality: values.quality ?? '',
    supplier: values.supplier ?? { id: 'supplier', name: 'Fornecedor' },
    city: values.city ?? '',
    deliveryTime: values.deliveryTime ?? '',
    contact: values.contact ?? '',
    notes: values.notes ?? '',
    costProduct: values.costProduct ?? 100,
    quoteDate: values.quoteDate ?? '2026-08-18',
    updatedAt: values.updatedAt ?? '2026-08-18',
    status: values.status ?? 'valid',
    valid: values.valid ?? true,
    inconsistencies: values.inconsistencies ?? [],
  };
}

test('deriva facetas em cascata sem misturar categorias ou modelos', () => {
  const quotes = [
    quote({
      productName: 'iPhone 17 128GB Azul',
      category: 'iPhone',
      model: 'iPhone 17',
      color: 'Azul',
      capacity: '128GB',
    }),
    quote({
      productName: 'iPhone 17 256GB Preto',
      category: 'iPhone',
      model: 'iPhone 17',
      color: 'Preto',
      capacity: '256GB',
    }),
    quote({
      productName: 'iPhone 16 128GB Azul',
      category: 'iPhone',
      model: 'iPhone 16',
      color: 'Azul',
      capacity: '128GB',
    }),
    quote({
      productName: 'iPad 11 A16 256GB',
      category: 'iPad',
      model: 'iPad 11 A16',
      color: 'Cinza',
      capacity: '256GB',
    }),
  ];
  const categoryFilters = { ...emptyBrazilRadarFacetState, categories: ['iPhone'] };
  const categoryFacets = buildBrazilRadarFacets(quotes, categoryFilters);

  assert.deepEqual(categoryFacets.models.map((option) => option.label).sort(), [
    'iPhone 16',
    'iPhone 17',
  ]);
  assert.ok(categoryFacets.models.every((option) => option.label.startsWith('iPhone')));

  const modelFilters = { ...categoryFilters, models: ['iphone-17'] };
  const modelFacets = buildBrazilRadarFacets(quotes, modelFilters);
  assert.deepEqual(modelFacets.colors.map((option) => option.value).sort(), ['azul', 'preto']);
  assert.deepEqual(modelFacets.capacities.map((option) => option.value).sort(), ['128GB', '256GB']);
  assert.equal(
    new Set(modelFacets.colors.map((option) => option.value)).size,
    modelFacets.colors.length,
  );
});

test('considera os demais filtros ao derivar condicao e permite trocar a propria dimensao', () => {
  const quotes = [
    quote({
      productName: 'iPhone 17 128GB Azul',
      category: 'iPhone',
      model: 'iPhone 17',
      color: 'Azul',
      capacity: '128GB',
      quality: 'Novo',
    }),
    quote({
      productName: 'iPhone 17 128GB Preto',
      category: 'iPhone',
      model: 'iPhone 17',
      color: 'Preto',
      capacity: '128GB',
      quality: 'CPO',
    }),
    quote({
      productName: 'iPhone 16 128GB Azul',
      category: 'iPhone',
      model: 'iPhone 16',
      color: 'Azul',
      capacity: '128GB',
      quality: 'Novo',
    }),
  ];
  const filters = {
    ...emptyBrazilRadarFacetState,
    categories: ['iPhone'],
    models: ['iphone-17'],
  };
  const facets = buildBrazilRadarFacets(quotes, filters);

  assert.deepEqual(
    facets.conditions.map((option) => option.value),
    ['Novo', 'CPO'],
  );
  const colorFacets = buildBrazilRadarFacets(quotes, { ...filters, colors: ['azul'] });
  assert.deepEqual(
    colorFacets.colors.map((option) => option.value),
    ['azul', 'preto'],
  );
});

test('limpa somente selecoes que deixaram de existir no conjunto compativel', () => {
  const quotes = [
    quote({
      productName: 'iPhone 17 128GB Azul',
      category: 'iPhone',
      model: 'iPhone 17',
      color: 'Azul',
      capacity: '128GB',
    }),
    quote({
      productName: 'iPad 11 A16 256GB',
      category: 'iPad',
      model: 'iPad 11 A16',
      color: 'Cinza',
      capacity: '256GB',
    }),
  ];
  const filters = {
    ...emptyBrazilRadarFacetState,
    categories: ['iPad'],
    models: ['iphone-17'],
    colors: ['azul'],
  };
  const facets = buildBrazilRadarFacets(quotes, filters);
  const firstPass = normalizeBrazilRadarFacetState(filters, facets, 'categories');
  const normalized = normalizeBrazilRadarFacetState(
    firstPass,
    buildBrazilRadarFacets(quotes, firstPass),
  );

  assert.deepEqual(normalized.categories, ['iPad']);
  assert.deepEqual(normalized.models, []);
  assert.deepEqual(normalized.colors, []);
  assert.equal(areBrazilRadarFacetStatesEqual(filters, normalized), false);
  assert.equal(filterBrazilRadarQuotes(quotes, normalized).length, 1);
});
