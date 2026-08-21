import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areBrazilRadarFacetStatesEqual,
  buildBrazilRadarFacetIndex,
  buildBrazilRadarFacets,
  buildBrazilRadarFacetsFromIndex,
  emptyBrazilRadarFacetState,
  filterBrazilRadarQuotes,
  filterBrazilRadarQuotesByIndex,
  normalizeBrazilRadarFacetState,
  queryBrazilRadarFacetIndex,
} from './brazil-radar-facets';
import { PriceQuoteItem } from '../types/price-radar';

function quote(values: Partial<PriceQuoteItem>): PriceQuoteItem {
  return {
    id: values.id ?? `quote-${Math.random()}`,
    productId: values.productId ?? null,
    supplierId: values.supplierId ?? 'supplier',
    productName: values.productName ?? '',
    category: values.category ?? '',
    model: values.model ?? '',
    color: values.color ?? '',
    capacity: values.capacity ?? '',
    productType: values.productType ?? '',
    quality: values.quality ?? 'Novo',
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

const quotes = [
  quote({
    id: 'iphone-17-128-blue',
    productName: 'iPhone 17 128GB Azul',
    category: 'iPhone',
    model: 'iPhone 17',
    color: 'Azul',
    capacity: '128GB',
    costProduct: 4300,
  }),
  quote({
    id: 'iphone-17-256-black',
    productName: 'iPhone 17 256GB Preto',
    category: 'iPhone',
    model: 'iPhone 17',
    color: 'Preto',
    capacity: '256GB',
    costProduct: 4700,
  }),
  quote({
    id: 'iphone-16-128-blue',
    productName: 'iPhone 16 128GB Azul',
    category: 'iPhone',
    model: 'iPhone 16',
    color: 'Azul',
    capacity: '128GB',
    costProduct: 3900,
  }),
  quote({
    id: 'ipad-11-256',
    productName: 'iPad 11 A16 256GB Cinza',
    category: 'iPad',
    model: 'iPad 11 A16',
    color: 'Cinza',
    capacity: '256GB',
    costProduct: 3200,
  }),
];

test('motor indexado preserva resultados do motor aprovado', () => {
  const index = buildBrazilRadarFacetIndex(quotes);
  const states = [
    emptyBrazilRadarFacetState,
    { ...emptyBrazilRadarFacetState, categories: ['iPhone'] },
    { ...emptyBrazilRadarFacetState, models: ['iphone-17'], colors: ['azul'] },
    { ...emptyBrazilRadarFacetState, minPrice: '4000', maxPrice: '4800' },
    {
      ...emptyBrazilRadarFacetState,
      categories: ['iPhone'],
      models: ['iphone-17'],
      capacities: ['256GB'],
    },
  ];

  states.forEach((filters) => {
    assert.deepEqual(
      filterBrazilRadarQuotesByIndex(index, filters).map((item) => item.id),
      filterBrazilRadarQuotes(quotes, filters).map((item) => item.id),
    );
    assert.deepEqual(buildBrazilRadarFacetsFromIndex(index, filters), buildBrazilRadarFacets(quotes, filters));
  });
});

test('facets indexados mantem self-excluding e reset aprovado', () => {
  const index = buildBrazilRadarFacetIndex(quotes);
  const filters = {
    ...emptyBrazilRadarFacetState,
    categories: ['iPhone'],
    models: ['iphone-17'],
    colors: ['azul'],
  };
  const indexedFacets = buildBrazilRadarFacetsFromIndex(index, filters);
  const legacyFacets = buildBrazilRadarFacets(quotes, filters);

  assert.deepEqual(indexedFacets.colors, legacyFacets.colors);
  assert.deepEqual(indexedFacets.capacities, legacyFacets.capacities);

  const changedCategory = { ...filters, categories: ['iPad'] };
  const firstPass = normalizeBrazilRadarFacetState(
    changedCategory,
    buildBrazilRadarFacetsFromIndex(index, changedCategory),
    'categories',
  );
  const normalized = normalizeBrazilRadarFacetState(
    firstPass,
    buildBrazilRadarFacetsFromIndex(index, firstPass),
  );

  assert.deepEqual(normalized.categories, ['iPad']);
  assert.deepEqual(normalized.models, []);
  assert.deepEqual(normalized.colors, []);
  assert.equal(areBrazilRadarFacetStatesEqual(changedCategory, normalized), false);
});

test('consulta indexada intersecta o menor conjunto e nao canoniza durante a consulta', () => {
  const index = buildBrazilRadarFacetIndex(quotes);
  const filters = {
    ...emptyBrazilRadarFacetState,
    categories: ['iPhone'],
    models: ['iphone-17'],
    capacities: ['256GB'],
  };
  const firstRows = Array.from(queryBrazilRadarFacetIndex(index, filters));
  const secondRows = Array.from(queryBrazilRadarFacetIndex(index, filters));

  assert.deepEqual(firstRows, ['iphone-17-256-black']);
  assert.deepEqual(secondRows, firstRows);
  assert.equal(index.rows.size, quotes.length);
});

test('preserva Fones como categoria estruturada no indice do Radar', () => {
  const airpodsNovo = quote({
    id: 'airpods-pro-3-novo',
    productName: 'AirPods Pro 3',
    category: 'Fones',
    model: 'AirPods Pro 3',
    quality: 'Novo',
  });
  const airpodsCpo = quote({
    id: 'airpods-pro-3-cpo',
    productName: 'AirPods Pro 3',
    category: 'Fones',
    model: 'AirPods Pro 3',
    quality: 'CPO',
  });
  const airpodsMisclassified = quote({
    id: 'airpods-misclassified',
    productName: 'AirPods Pro 3',
    category: 'iPhone',
    model: 'AirPods Pro 3',
  });
  const index = buildBrazilRadarFacetIndex([airpodsNovo, airpodsCpo, airpodsMisclassified]);
  const facets = buildBrazilRadarFacetsFromIndex(index);

  assert.deepEqual(
    facets.categories.map((item) => item.label),
    ['Fones', 'Acessorios'],
  );
  assert.deepEqual(
    filterBrazilRadarQuotesByIndex(index, {
      ...emptyBrazilRadarFacetState,
      categories: ['Fones'],
    }).map((item) => item.id),
    ['airpods-pro-3-novo', 'airpods-pro-3-cpo'],
  );
  assert.deepEqual(
    filterBrazilRadarQuotesByIndex(index, {
      ...emptyBrazilRadarFacetState,
      categories: ['Fones'],
      condition: 'Novo',
    }).map((item) => item.id),
    ['airpods-pro-3-novo'],
  );
  assert.deepEqual(
    filterBrazilRadarQuotesByIndex(index, {
      ...emptyBrazilRadarFacetState,
      categories: ['Fones'],
    }).some((item) => item.id === 'airpods-misclassified'),
    false,
  );
});

test('escala de 10 mil itens cria o indice uma vez e reutiliza as linhas normalizadas', () => {
  const dataset = Array.from({ length: 10_000 }, (_, index) =>
    quote({
      id: `synthetic-${index}`,
      productName: `iPhone 17 ${index % 2 ? '128GB Azul' : '256GB Preto'}`,
      category: 'iPhone',
      model: 'iPhone 17',
      color: index % 2 ? 'Azul' : 'Preto',
      capacity: index % 2 ? '128GB' : '256GB',
      costProduct: 4000 + (index % 200),
    }),
  );
  const index = buildBrazilRadarFacetIndex(dataset);
  const filters = { ...emptyBrazilRadarFacetState, models: ['iphone-17'], capacities: ['256GB'] };

  assert.equal(index.rows.size, 10_000);
  assert.equal(filterBrazilRadarQuotesByIndex(index, filters).length, 5_000);
  assert.equal(filterBrazilRadarQuotesByIndex(index, { ...filters, colors: ['azul'] }).length, 0);
  assert.equal(filterBrazilRadarQuotesByIndex(index, { ...filters, colors: ['preto'] }).length, 5_000);
  assert.equal(index.rows.size, 10_000);
});
