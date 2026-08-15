import { PriceQuoteItem } from '../types/price-radar';

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

export const emptyBrazilRadarFacetState: BrazilRadarFacetState = {
  categories: [],
  models: [],
  condition: '',
  colors: [],
  capacities: [],
  minPrice: '',
  maxPrice: '',
};

const colorDefinitions = [
  { value: 'preto', label: 'Preto', swatch: '#171717', terms: ['black', 'preto', 'midnight'] },
  {
    value: 'cinza-espacial',
    label: 'Cinza Espacial',
    swatch: '#71717a',
    terms: ['space gray', 'space grey', 'cinza espacial', 'grafite', 'graphite', 'grey', 'gray'],
  },
  { value: 'branco', label: 'Branco', swatch: '#f8fafc', terms: ['white', 'branco'] },
  { value: 'prata', label: 'Prata', swatch: '#d4d4d8', terms: ['silver', 'prata'] },
  { value: 'azul-profundo', label: 'Azul Profundo', swatch: '#1e3a8a', terms: ['deep blue'] },
  { value: 'azul', label: 'Azul', swatch: '#2563eb', terms: ['blue', 'azul', 'skyblue', 'sky blue'] },
  { value: 'rosa', label: 'Rosa', swatch: '#f9a8d4', terms: ['pink', 'rosa', 'rose', 'blush'] },
  { value: 'roxo', label: 'Roxo', swatch: '#8b5cf6', terms: ['purple', 'roxo', 'lilas', 'lavender'] },
  { value: 'verde', label: 'Verde', swatch: '#22c55e', terms: ['green', 'verde', 'sage'] },
  { value: 'laranja', label: 'Laranja', swatch: '#f97316', terms: ['orange', 'laranja', 'cosmic orange'] },
  { value: 'amarelo', label: 'Amarelo', swatch: '#eab308', terms: ['yellow', 'amarelo', 'citrus'] },
  { value: 'dourado', label: 'Dourado', swatch: '#d4a72c', terms: ['gold', 'dourado', 'starlight'] },
  { value: 'titanio-natural', label: 'Titanio Natural', swatch: '#a8a29e', terms: ['natural titanium', 'titanio natural', 'natural'] },
  { value: 'deserto', label: 'Titanio Deserto', swatch: '#c6a477', terms: ['desert', 'deserto'] },
] as const;

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
  const normalized = normalizeSearchText(searchable);

  return !(
    /\bhomologacao\b|\bteste?s?\b|\bdummy\b|\bmock\b/.test(normalized) ||
    /\b\d{10,}\b/.test(normalized)
  );
}

export function buildBrazilRadarFacets(quotes: PriceQuoteItem[]): BrazilRadarFacets {
  const prices = quotes.map((quote) => quote.costProduct).filter((price) => Number.isFinite(price) && price >= 0);

  return {
    categories: countFacetValues(quotes, (quote) => [getCanonicalCategory(quote)], categoryOrder),
    models: countFacetValues(quotes, (quote) => [getCanonicalModel(quote)]).sort(sortModelsNewestFirst),
    conditions: countFacetValues(quotes, (quote) => [getCanonicalCondition(quote)], conditionOrder),
    colors: countFacetValues(quotes, getCanonicalColors).map((option) => ({
      ...option,
      swatch: colorDefinitions.find((color) => color.value === option.value)?.swatch,
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
      (!filters.models.length || filters.models.includes(getCanonicalModel(quote))) &&
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

function getCanonicalCategory(quote: PriceQuoteItem) {
  const text = normalizeSearchText(`${quote.category} ${quote.productName} ${quote.model}`);

  if (/\biphone\b/.test(text)) return 'iPhone';
  if (/\bipad\b/.test(text)) return 'iPad';
  if (/\bmacbook\b|\bmac\s+(?:air|pro|neo)\b/.test(text)) return 'MacBook';
  if (/\bapple\s*watch\b|\bwatch\s+(?:s\d+|se\d*|ultra)\b/.test(text)) return 'Apple Watch';
  if (/airpods?|airtag|pencil|magic\s+(?:mouse|keyboard)|cabo|fonte|carregador/.test(text)) {
    return 'Acessorios';
  }
  return 'Eletronicos';
}

function getCanonicalModel(quote: PriceQuoteItem) {
  const raw = normalizeSearchText(`${quote.model} ${quote.productName}`);

  const iphone = raw.match(/\biphone\s*(\d{1,2})\s*(pro\s*max|promax|pro|max|plus|air|e)?\b/);
  if (iphone) {
    const variant = normalizeIphoneVariant(iphone[2] ?? '');
    return `iPhone ${iphone[1]}${variant ? ` ${variant}` : ''}`;
  }

  const watch = raw.match(/\b(?:apple\s*)?watch\s*(ultra|series|s|se)?\s*(\d+)?\s*(\d{2})?\s*mm?/);
  if (watch) {
    const family = watch[1] === 'ultra'
      ? `Ultra${watch[2] ? ` ${watch[2]}` : ''}`
      : watch[1] === 'se'
        ? `SE${watch[2] ? ` ${watch[2]}` : ''}`
        : watch[2]
          ? `Series ${watch[2]}`
          : 'Series';
    return `Apple Watch ${family}${watch[3] ? ` ${watch[3]}mm` : ''}`;
  }

  const compactWatch = raw.match(/\b(?:apple\s*)?(?:watch\s*)?(ultra|s|se)\s*(\d+)\s*(\d{2})\s*mm?/);
  if (compactWatch?.[1] && compactWatch[2] && compactWatch[3]) {
    const family = compactWatch[1] === 's' ? `Series ${compactWatch[2]}` : `${titleWord(compactWatch[1])} ${compactWatch[2]}`;
    return `Apple Watch ${family} ${compactWatch[3]}mm`;
  }

  const macbook = raw.match(/\b(?:macbook|mac)\s*(air|pro|neo)\b/);
  if (macbook?.[1]) {
    const family = titleWord(macbook[1]);
    const chip = raw.match(/\bm\d+(?:\s+(?:pro|max))?\b/)?.[0];
    const screen = raw.match(/\b(13(?:\.6)?|14(?:\.2)?|15(?:\.3)?|16(?:\.2)?)\s*(?:inch|polegadas?|["”])/i)?.[1];
    return `MacBook ${family}${chip ? ` ${formatChip(chip)}` : ''}${screen ? ` ${screen.replace(/\.\d$/, '')}"` : ''}`;
  }

  const macMini = raw.match(/\bmac\s*mini\s*(m\d+(?:\s+pro)?)?/);
  if (macMini) return `Mac Mini${macMini[1] ? ` ${formatChip(macMini[1])}` : ''}`;

  const ipad = raw.match(/\bipad\s*(pro|air|mini)?\s*(m\d+|a\d+)?\s*(\d{1,2}(?:\.\d+)?)?\s*(?:inch|polegadas?|["”])?/);
  if (ipad) {
    return ['iPad', ipad[1] ? titleWord(ipad[1]) : '', ipad[2]?.toUpperCase() ?? '', ipad[3] ? `${ipad[3]}"` : '']
      .filter(Boolean)
      .join(' ');
  }

  const airpods = raw.match(/\bair\s*pods?\s*(pro|max)?\s*(\d+)?\s*(anc)?/);
  if (airpods) {
    return ['AirPods', airpods[1] ? titleWord(airpods[1]) : '', airpods[2] ?? '', airpods[3]?.toUpperCase() ?? '']
      .filter(Boolean)
      .join(' ');
  }

  return toTitleCase(
    raw
      .replace(/\b(?:64|128|256|512)\s*gb\b|\b[12]\s*tb\b/g, ' ')
      .replace(/\b(?:wifi|wi fi|gps|cellular|esim|e sim|americano|americana|lla|jp|hn|anatel)\b/g, ' ')
      .replace(/\b\d+\s*(?:ram|cpu|gpu|ssd)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function getCanonicalColors(quote: PriceQuoteItem) {
  const text = normalizeSearchText(quote.color);
  const colors = colorDefinitions
    .filter((definition) => {
      if (definition.value === 'azul' && containsTerm(text, 'deep blue')) return false;
      return definition.terms.some((term) => containsTerm(text, term));
    })
    .map((definition) => definition.value);

  if (colors.length) return Array.from(new Set(colors));
  const fallback = toTitleCase(text);
  return fallback ? [fallback] : [];
}

function getCanonicalCapacities(quote: PriceQuoteItem) {
  const text = normalizeSearchText(`${quote.capacity} ${quote.model} ${quote.productName}`)
    .replace(/(\d+)\s*(gb|tb)/g, '$1$2');
  return capacityOrder.filter((capacity) => new RegExp(`\\b${capacity.toLowerCase()}\\b`).test(text));
}

function getCanonicalCondition(quote: PriceQuoteItem) {
  const text = normalizeSearchText(`${quote.quality} ${quote.productType} ${quote.productName} ${quote.notes}`);
  if (/\bcpo\b|certified pre owned|refurbished/.test(text)) return 'CPO';
  if (/seminovo|semi novo|usado|vitrine|open box|swap/.test(text)) return 'Seminovo';
  return 'Novo';
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
      return (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) - (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder);
    }
    return a.label.localeCompare(b.label, 'pt-BR');
  });
}

function sortModelsNewestFirst(a: FacetOption, b: FacetOption) {
  const aVersion = Number(a.label.match(/\b(\d{1,4})\b/)?.[1] ?? 0);
  const bVersion = Number(b.label.match(/\b(\d{1,4})\b/)?.[1] ?? 0);
  return bVersion - aVersion || a.label.localeCompare(b.label, 'pt-BR');
}

function normalizeIphoneVariant(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized === 'promax' || normalized === 'pro max' || normalized === 'max') return 'Pro Max';
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'plus') return 'Plus';
  if (normalized === 'air') return 'Air';
  if (normalized === 'e') return 'e';
  return '';
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/[|_/()[\]{}:;,+*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatChip(value: string) {
  return value
    .split(' ')
    .map((part) => (part.startsWith('m') ? part.toUpperCase() : titleWord(part)))
    .join(' ');
}

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map(titleWord)
    .join(' ')
    .replace(/\bIphone\b/g, 'iPhone')
    .replace(/\bIpad\b/g, 'iPad')
    .replace(/\bMacbook\b/g, 'MacBook')
    .replace(/\bAirpods\b/g, 'AirPods');
}

function titleWord(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';
}
