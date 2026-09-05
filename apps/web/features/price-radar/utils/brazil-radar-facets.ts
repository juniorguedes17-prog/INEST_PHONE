import { PriceQuoteItem } from '../types/price-radar';
import {
  CanonicalProductSource,
  canonicalColorAliases,
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
} from './canonical-product-identity';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
  swatch?: string;
}

export interface BrazilRadarFacetState {
  categories: string[];
  models: string[];
  condition: string;
  colors: string[];
  capacities: string[];
  minPrice: string;
  maxPrice: string;
}

export interface BrazilRadarFacets {
  categories: FacetOption[];
  models: FacetOption[];
  conditions: FacetOption[];
  colors: FacetOption[];
  capacities: FacetOption[];
  priceMin: number;
  priceMax: number;
}

export interface BrazilRadarFilterRow {
  id: string;
  quote: PriceQuoteItem;
  category: string;
  model: string;
  modelLabel: string;
  condition: string;
  colors: string[];
  capacities: string[];
  price: number;
}

export interface RadarFacetIndex {
  rows: Map<string, BrazilRadarFilterRow>;
  orderById: Map<string, number>;
  allIds: Set<string>;
  facets: {
    categories: Map<string, Set<string>>;
    models: Map<string, Set<string>>;
    conditions: Map<string, Set<string>>;
    colors: Map<string, Set<string>>;
    capacities: Map<string, Set<string>>;
  };
  prices: Array<{ id: string; value: number }>;
}

export type BrazilRadarFacetDimension =
  'categories' | 'models' | 'condition' | 'colors' | 'capacities' | 'price';

export type CatalogFacetSource = CanonicalProductSource;

export const emptyBrazilRadarFacetState: BrazilRadarFacetState = {
  categories: [],
  models: [],
  condition: '',
  colors: [],
  capacities: [],
  minPrice: '',
  maxPrice: '',
};

export function buildBrazilRadarFacetIndex(quotes: PriceQuoteItem[]): RadarFacetIndex {
  const rows = new Map<string, BrazilRadarFilterRow>();
  const facets: RadarFacetIndex['facets'] = {
    categories: new Map(),
    models: new Map(),
    conditions: new Map(),
    colors: new Map(),
    capacities: new Map(),
  };

  quotes.forEach((quote) => {
    const row = normalizeBrazilRadarFilterRow(quote);
    rows.set(row.id, row);
    addFacetValues(facets.categories, row.category, row.id);
    addFacetValues(facets.models, row.model, row.id);
    addFacetValues(facets.conditions, row.condition, row.id);
    addFacetValues(facets.colors, row.colors, row.id);
    addFacetValues(facets.capacities, row.capacities, row.id);
  });

  return {
    rows,
    orderById: new Map(Array.from(rows.keys()).map((id, position) => [id, position])),
    allIds: new Set(rows.keys()),
    facets,
    prices: Array.from(rows.values())
      .filter((row) => Number.isFinite(row.price) && row.price >= 0)
      .map((row) => ({ id: row.id, value: row.price }))
      .sort((left, right) => left.value - right.value),
  };
}

export function queryBrazilRadarFacetIndex(
  index: RadarFacetIndex,
  filters: BrazilRadarFacetState,
  excludedDimension?: BrazilRadarFacetDimension,
) {
  const matchingSets: Set<string>[] = [];

  addSelectedFacetSet(
    matchingSets,
    index.facets.categories,
    filters.categories,
    excludedDimension === 'categories',
  );
  addSelectedFacetSet(
    matchingSets,
    index.facets.models,
    filters.models,
    excludedDimension === 'models',
  );
  addSelectedFacetSet(
    matchingSets,
    index.facets.conditions,
    filters.condition ? [filters.condition] : [],
    excludedDimension === 'condition',
  );
  addSelectedFacetSet(
    matchingSets,
    index.facets.colors,
    filters.colors,
    excludedDimension === 'colors',
  );
  addSelectedFacetSet(
    matchingSets,
    index.facets.capacities,
    filters.capacities,
    excludedDimension === 'capacities',
  );

  if (excludedDimension !== 'price' && (filters.minPrice !== '' || filters.maxPrice !== '')) {
    matchingSets.push(queryPriceRange(index.prices, filters.minPrice, filters.maxPrice));
  }

  if (!matchingSets.length) return new Set(index.allIds);

  matchingSets.sort((left, right) => left.size - right.size);
  const result = new Set(matchingSets[0]);
  for (const candidate of matchingSets.slice(1)) {
    for (const id of result) {
      if (!candidate.has(id)) result.delete(id);
    }
    if (!result.size) break;
  }
  return result;
}

export function filterBrazilRadarQuotesByIndex(
  index: RadarFacetIndex,
  filters: BrazilRadarFacetState,
) {
  const matchingIds = queryBrazilRadarFacetIndex(index, filters);
  return Array.from(matchingIds)
    .sort((left, right) => index.orderById.get(left)! - index.orderById.get(right)!)
    .map((id) => index.rows.get(id)!.quote);
}

export function buildBrazilRadarFacetsFromIndex(
  index: RadarFacetIndex,
  filters: BrazilRadarFacetState = emptyBrazilRadarFacetState,
): BrazilRadarFacets {
  const categoryIds = queryBrazilRadarFacetIndex(index, filters, 'categories');
  const modelIds = queryBrazilRadarFacetIndex(index, filters, 'models');
  const conditionIds = queryBrazilRadarFacetIndex(index, filters, 'condition');
  const colorIds = queryBrazilRadarFacetIndex(index, filters, 'colors');
  const capacityIds = queryBrazilRadarFacetIndex(index, filters, 'capacities');
  const priceIds = queryBrazilRadarFacetIndex(index, filters, 'price');

  return {
    categories: countIndexedFacetValues(index, categoryIds, (row) => [row.category], categoryOrder),
    models: countIndexedModels(index, modelIds),
    conditions: countIndexedFacetValues(
      index,
      conditionIds,
      (row) => [row.condition],
      conditionOrder,
    ),
    colors: countIndexedFacetValues(index, colorIds, (row) => row.colors).map((option) => ({
      ...option,
      swatch: canonicalColorAliases.find((color) => color.value === option.value)?.swatch,
    })),
    capacities: countIndexedFacetValues(index, capacityIds, (row) => row.capacities, capacityOrder),
    priceMin: getIndexedPriceBoundary(index, priceIds, 'min'),
    priceMax: getIndexedPriceBoundary(index, priceIds, 'max'),
  };
}

const capacityOrder = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const categoryOrder = [
  'iPhone',
  'iPad',
  'MacBook',
  'Apple Watch',
  'Fones',
  'Garmin',
  'Eletronicos',
  'Acessorios',
];
const conditionOrder = ['Novo', 'Seminovo', 'CPO'];

export function isVisibleRadarQuote(quote: PriceQuoteItem) {
  const searchable = [
    quote.productName,
    quote.category,
    quote.model,
    quote.color,
    quote.capacity,
  ].join(' ');
  const normalized = normalizeCatalogFilterText(searchable);

  return !(
    /\bhomologacao\b|\bteste?s?\b|\bdummy\b|\bmock\b/.test(normalized) ||
    /\b\d{10,}\b/.test(normalized)
  );
}

export function buildBrazilRadarFacets(
  quotes: PriceQuoteItem[],
  filters: BrazilRadarFacetState = emptyBrazilRadarFacetState,
): BrazilRadarFacets {
  const categoryQuotes = filterBrazilRadarQuotes(quotes, filters, 'categories');
  const modelQuotes = filterBrazilRadarQuotes(quotes, filters, 'models');
  const conditionQuotes = filterBrazilRadarQuotes(quotes, filters, 'condition');
  const colorQuotes = filterBrazilRadarQuotes(quotes, filters, 'colors');
  const capacityQuotes = filterBrazilRadarQuotes(quotes, filters, 'capacities');
  const priceQuotes = filterBrazilRadarQuotes(quotes, filters, 'price');
  const prices = priceQuotes
    .map((quote) => quote.costProduct)
    .filter((price) => Number.isFinite(price) && price >= 0);

  return {
    categories: countFacetValues(
      categoryQuotes,
      (quote) => [getCanonicalCategory(quote)],
      categoryOrder,
    ),
    models: buildCanonicalModelFacetOptions(modelQuotes),
    conditions: countFacetValues(
      conditionQuotes,
      (quote) => [getCanonicalCondition(quote)],
      conditionOrder,
    ),
    colors: countFacetValues(colorQuotes, getCanonicalColors).map((option) => ({
      ...option,
      swatch: canonicalColorAliases.find((color) => color.value === option.value)?.swatch,
    })),
    capacities: countFacetValues(capacityQuotes, getCanonicalCapacities, capacityOrder),
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  };
}

export function filterBrazilRadarQuotes(
  quotes: PriceQuoteItem[],
  filters: BrazilRadarFacetState,
  excludedDimension?: BrazilRadarFacetDimension,
) {
  const minPrice = filters.minPrice === '' ? Number.NEGATIVE_INFINITY : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === '' ? Number.POSITIVE_INFINITY : Number(filters.maxPrice);

  return quotes.filter((quote) => {
    const quoteColors = getCanonicalColors(quote);
    const quoteCapacities = getCanonicalCapacities(quote);

    return (
      (excludedDimension === 'categories' ||
        !filters.categories.length ||
        filters.categories.includes(getCanonicalCategory(quote))) &&
      (excludedDimension === 'models' ||
        !filters.models.length ||
        filters.models.includes(getCanonicalModelKey(quote))) &&
      (excludedDimension === 'condition' ||
        !filters.condition ||
        filters.condition === getCanonicalCondition(quote)) &&
      (excludedDimension === 'colors' ||
        !filters.colors.length ||
        filters.colors.some((color) => quoteColors.includes(color))) &&
      (excludedDimension === 'capacities' ||
        !filters.capacities.length ||
        filters.capacities.some((capacity) => quoteCapacities.includes(capacity))) &&
      (excludedDimension === 'price' ||
        (quote.costProduct >= minPrice && quote.costProduct <= maxPrice))
    );
  });
}

export function normalizeBrazilRadarFacetState(
  filters: BrazilRadarFacetState,
  facets: BrazilRadarFacets,
  preservedDimension?: BrazilRadarFacetDimension,
): BrazilRadarFacetState {
  const valid = (options: FacetOption[], selected: string[]) => {
    const available = new Set(options.map((option) => option.value));
    return selected.filter((value) => available.has(value));
  };
  const normalizePrice = (value: string) => {
    if (!value) return '';
    const numericValue = Number(value);
    return Number.isFinite(numericValue) &&
      numericValue >= facets.priceMin &&
      numericValue <= facets.priceMax
      ? value
      : '';
  };
  const minPrice = normalizePrice(filters.minPrice);
  const maxPrice = normalizePrice(filters.maxPrice);
  const invertedPriceRange =
    minPrice !== '' && maxPrice !== '' && Number(minPrice) > Number(maxPrice);

  return {
    ...filters,
    categories:
      preservedDimension === 'categories'
        ? filters.categories
        : valid(facets.categories, filters.categories),
    models: preservedDimension === 'models' ? filters.models : valid(facets.models, filters.models),
    condition:
      preservedDimension === 'condition'
        ? filters.condition
        : facets.conditions.some((option) => option.value === filters.condition)
          ? filters.condition
          : '',
    colors: preservedDimension === 'colors' ? filters.colors : valid(facets.colors, filters.colors),
    capacities:
      preservedDimension === 'capacities'
        ? filters.capacities
        : valid(facets.capacities, filters.capacities),
    minPrice:
      preservedDimension === 'price' ? filters.minPrice : invertedPriceRange ? '' : minPrice,
    maxPrice:
      preservedDimension === 'price' ? filters.maxPrice : invertedPriceRange ? '' : maxPrice,
  };
}

export function areBrazilRadarFacetStatesEqual(
  left: BrazilRadarFacetState,
  right: BrazilRadarFacetState,
) {
  return (
    left.condition === right.condition &&
    left.minPrice === right.minPrice &&
    left.maxPrice === right.maxPrice &&
    arraysEqual(left.categories, right.categories) &&
    arraysEqual(left.models, right.models) &&
    arraysEqual(left.colors, right.colors) &&
    arraysEqual(left.capacities, right.capacities)
  );
}

export function countActiveBrazilRadarFacets(filters: BrazilRadarFacetState) {
  return (
    filters.categories.length +
    filters.models.length +
    filters.colors.length +
    filters.capacities.length +
    (filters.condition ? 1 : 0) +
    (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0)
  );
}

export function getCanonicalCategory(source: CatalogFacetSource) {
  const structuredCategory = normalizeCatalogFilterText(source.category ?? '');
  if (structuredCategory === 'fones') return 'Fones';
  if (structuredCategory === 'garmin') return 'Garmin';
  if (structuredCategory === 'eletronicos') return 'Eletronicos';
  return normalizeCanonicalProductIdentity(source).canonicalCategory;
}

export function getCanonicalModel(source: CatalogFacetSource) {
  return normalizeCanonicalProductIdentity(source).canonicalModelLabel;
}

export function getCanonicalModelKey(source: CatalogFacetSource) {
  return normalizeCanonicalProductIdentity(source).canonicalModelKey;
}

export function buildCanonicalModelFacetOptions<T extends CatalogFacetSource>(items: T[]) {
  const models = new Map<string, FacetOption>();
  items.forEach((item) => {
    const identity = normalizeCanonicalProductIdentity(item);
    if (
      !identity.canonicalModelMatched ||
      !identity.canonicalModelKey ||
      !identity.canonicalModelLabel
    )
      return;
    const current = models.get(identity.canonicalModelKey);
    models.set(identity.canonicalModelKey, {
      value: identity.canonicalModelKey,
      label: identity.canonicalModelLabel,
      count: (current?.count ?? 0) + 1,
    });
  });
  return Array.from(models.values()).sort(sortModelsNewestFirst);
}

export function getCanonicalColors(source: CatalogFacetSource) {
  const text = normalizeCatalogFilterText(source.color ?? '');
  const colors = canonicalColorAliases
    .filter((definition) => {
      if (definition.value === 'azul' && containsTerm(text, 'deep blue')) return false;
      return definition.terms.some((term) => containsTerm(text, term));
    })
    .map((definition) => definition.value);

  if (colors.length) return Array.from(new Set(colors));
  const fallback = toTitleCase(text);
  return fallback ? [fallback] : [];
}

export function getCanonicalCapacities(source: CatalogFacetSource) {
  const identity = normalizeCanonicalProductIdentity(source);
  return getCanonicalCapacitiesFromIdentity(source, identity);
}

function normalizeBrazilRadarFilterRow(quote: PriceQuoteItem): BrazilRadarFilterRow {
  const identity = normalizeCanonicalProductIdentity(quote);

  return {
    id: quote.id,
    quote,
    category: getCanonicalCategory(quote),
    model: identity.canonicalModelKey,
    modelLabel: identity.canonicalModelMatched ? identity.canonicalModelLabel : '',
    condition: identity.canonicalCondition ?? '',
    colors: getCanonicalColors(quote),
    capacities: getCanonicalCapacitiesFromIdentity(quote, identity),
    price: quote.costProduct,
  };
}

function getCanonicalCapacitiesFromIdentity(
  source: CatalogFacetSource,
  identity: ReturnType<typeof normalizeCanonicalProductIdentity>,
) {
  const text = normalizeCatalogFilterText(
    `${source.capacity ?? ''} ${source.model ?? ''} ${source.productName ?? ''}`,
  ).replace(/(\d+)\s*(gb|tb)/g, '$1$2');

  return Array.from(
    new Set([
      ...(identity.canonicalStorage ? [identity.canonicalStorage] : []),
      ...capacityOrder.filter((capacity) =>
        new RegExp(`\\b${capacity.toLowerCase()}\\b`).test(text),
      ),
    ]),
  );
}

export function getCanonicalCondition(source: CatalogFacetSource) {
  return normalizeCanonicalProductIdentity(source).canonicalCondition ?? '';
}

function countFacetValues(
  quotes: PriceQuoteItem[],
  getValues: (quote: PriceQuoteItem) => string[],
  preferredOrder: string[] = [],
) {
  const counts = new Map<string, number>();
  quotes.forEach((quote) => {
    new Set(getValues(quote).filter(Boolean)).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return Array.from(counts, ([value, count]) => ({ value, label: value, count })).sort((a, b) => {
    const aOrder = preferredOrder.indexOf(a.value);
    const bOrder = preferredOrder.indexOf(b.value);
    if (aOrder >= 0 || bOrder >= 0) {
      return (
        (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) -
        (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder)
      );
    }
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

function addFacetValues(facet: Map<string, Set<string>>, values: string | string[], id: string) {
  const normalizedValues = Array.isArray(values) ? values : [values];
  new Set(normalizedValues.filter(Boolean)).forEach((value) => {
    const ids = facet.get(value) ?? new Set<string>();
    ids.add(id);
    facet.set(value, ids);
  });
}

function addSelectedFacetSet(
  matchingSets: Set<string>[],
  facet: Map<string, Set<string>>,
  selected: string[],
  excluded: boolean,
) {
  if (excluded || !selected.length) return;

  const union = new Set<string>();
  selected.forEach((value) => {
    facet.get(value)?.forEach((id) => union.add(id));
  });
  matchingSets.push(union);
}

function queryPriceRange(
  prices: Array<{ id: string; value: number }>,
  minValue: string,
  maxValue: string,
) {
  const min = minValue === '' ? Number.NEGATIVE_INFINITY : Number(minValue);
  const max = maxValue === '' ? Number.POSITIVE_INFINITY : Number(maxValue);
  if (Number.isNaN(min) || Number.isNaN(max)) return new Set<string>();

  const start = lowerBound(prices, min);
  const end = upperBound(prices, max);
  return new Set(prices.slice(start, end).map((entry) => entry.id));
}

function lowerBound(prices: Array<{ id: string; value: number }>, value: number) {
  let low = 0;
  let high = prices.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const entry = prices[middle]!;
    if (entry.value < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBound(prices: Array<{ id: string; value: number }>, value: number) {
  let low = 0;
  let high = prices.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const entry = prices[middle]!;
    if (entry.value <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

function countIndexedFacetValues(
  index: RadarFacetIndex,
  ids: Set<string>,
  getValues: (row: BrazilRadarFilterRow) => string[],
  preferredOrder: string[] = [],
) {
  const counts = new Map<string, number>();
  ids.forEach((id) => {
    const row = index.rows.get(id);
    if (!row) return;
    new Set(getValues(row).filter(Boolean)).forEach((value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return sortFacetOptions(
    Array.from(counts, ([value, count]) => ({ value, label: value, count })),
    preferredOrder,
  );
}

function countIndexedModels(index: RadarFacetIndex, ids: Set<string>) {
  const counts = new Map<string, { label: string; count: number }>();
  ids.forEach((id) => {
    const row = index.rows.get(id);
    if (!row || !row.model || !row.modelLabel) return;
    const current = counts.get(row.model);
    counts.set(row.model, {
      label: row.modelLabel,
      count: (current?.count ?? 0) + 1,
    });
  });

  return Array.from(counts, ([value, option]) => ({ value, ...option })).sort(
    sortModelsNewestFirst,
  );
}

function sortFacetOptions(options: FacetOption[], preferredOrder: string[]) {
  return options.sort((left, right) => {
    const leftOrder = preferredOrder.indexOf(left.value);
    const rightOrder = preferredOrder.indexOf(right.value);
    if (leftOrder >= 0 || rightOrder >= 0) {
      return (
        (leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder) -
        (rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder)
      );
    }
    return left.label.localeCompare(right.label, 'pt-BR');
  });
}

function getIndexedPriceBoundary(
  index: RadarFacetIndex,
  ids: Set<string>,
  boundary: 'min' | 'max',
) {
  const values = Array.from(ids)
    .map((id) => index.rows.get(id)?.price)
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0,
    );
  if (!values.length) return 0;
  return boundary === 'min' ? Math.floor(Math.min(...values)) : Math.ceil(Math.max(...values));
}

function sortModelsNewestFirst(a: FacetOption, b: FacetOption) {
  const aVersion = Number(a.label.match(/\b(\d{1,4})\b/)?.[1] ?? 0);
  const bVersion = Number(b.label.match(/\b(\d{1,4})\b/)?.[1] ?? 0);
  return bVersion - aVersion || a.label.localeCompare(b.label, 'pt-BR');
}

export function normalizeCatalogFilterText(value: string | null | undefined) {
  return normalizeCanonicalText(value);
}

export function getCatalogFacetLabel(value: string) {
  return canonicalColorAliases.find((color) => color.value === value)?.label ?? value;
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
