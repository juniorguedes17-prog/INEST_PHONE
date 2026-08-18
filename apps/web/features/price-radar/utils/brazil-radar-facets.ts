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

const capacityOrder = ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const categoryOrder = ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'Eletronicos', 'Acessorios'];
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
  return normalizeCanonicalProductIdentity(source).canonicalCondition;
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
