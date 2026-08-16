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

export function buildBrazilRadarFacets(quotes: PriceQuoteItem[]): BrazilRadarFacets {
  const prices = quotes
    .map((quote) => quote.costProduct)
    .filter((price) => Number.isFinite(price) && price >= 0);

  return {
    categories: countFacetValues(quotes, (quote) => [getCanonicalCategory(quote)], categoryOrder),
    models: buildCanonicalModelFacetOptions(quotes),
    conditions: countFacetValues(quotes, (quote) => [getCanonicalCondition(quote)], conditionOrder),
    colors: countFacetValues(quotes, getCanonicalColors).map((option) => ({
      ...option,
      swatch: canonicalColorAliases.find((color) => color.value === option.value)?.swatch,
    })),
    capacities: countFacetValues(quotes, getCanonicalCapacities, capacityOrder),
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : 0,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : 0,
  };
}

export function filterBrazilRadarQuotes(
  quotes: PriceQuoteItem[],
  filters: BrazilRadarFacetState,
) {
  const minPrice = filters.minPrice === '' ? Number.NEGATIVE_INFINITY : Number(filters.minPrice);
  const maxPrice = filters.maxPrice === '' ? Number.POSITIVE_INFINITY : Number(filters.maxPrice);

  return quotes.filter((quote) => {
    const quoteColors = getCanonicalColors(quote);
    const quoteCapacities = getCanonicalCapacities(quote);

    return (
      (!filters.categories.length || filters.categories.includes(getCanonicalCategory(quote))) &&
      (!filters.models.length || filters.models.includes(getCanonicalModelKey(quote))) &&
      (!filters.condition || filters.condition === getCanonicalCondition(quote)) &&
      (!filters.colors.length || filters.colors.some((color) => quoteColors.includes(color))) &&
      (!filters.capacities.length || filters.capacities.some((capacity) => quoteCapacities.includes(capacity))) &&
      quote.costProduct >= minPrice &&
      quote.costProduct <= maxPrice
    );
  });
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
    if (!identity.canonicalModelKey || !identity.canonicalModelLabel) return;
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

  return Array.from(new Set([
    ...(identity.canonicalStorage ? [identity.canonicalStorage] : []),
    ...capacityOrder.filter((capacity) =>
      new RegExp(`\\b${capacity.toLowerCase()}\\b`).test(text),
    ),
  ]));
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
      return (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) -
        (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder);
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
