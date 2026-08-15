import { ParsedSupplierListItem } from './evolution-webhook.types';

const PRODUCT_MARKERS = /\b(iphone|ipad|mac\s?book|macbook|mac\s?mini|imac|watch|airpods|air\s?pods|airtag|pencil|magic\s?mouse|earpods)\b/i;
const CURRENCY_MARKER = String.raw`(?:R\$|\$R|\$|\u{1F4B0}|\u{1F4B2}|\u{1F4B5})`;
const MONEY_VALUE = String.raw`\d(?:[\d.,]|\s(?=\d{3}(?:\D|$)))*`;
const PRICE_PREFIX = new RegExp(`${CURRENCY_MARKER}\\s*(${MONEY_VALUE})`, 'iu');
const PRICE_SUFFIX = new RegExp(`(${MONEY_VALUE})\\s*(?:R\\$|\\$R)`, 'iu');
const COLOR_MARKERS = [
  'preto',
  'black',
  'branco',
  'white',
  'silver',
  'azul',
  'blue',
  'laranja',
  'orange',
  'roxo',
  'purple',
  'rosa',
  'pink',
  'starlight',
  'midnight',
  'natural',
  'desert',
  'verde',
  'green',
  'space gray',
  'space grey',
  'gold',
  'teal',
  'indigo',
  'citrus',
  'blush',
];

export function parseSupplierListText(content: string): ParsedSupplierListItem[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
  const items: ParsedSupplierListItem[] = [];
  let currentProduct: string | null = null;
  let activeCategory: string | null = null;
  let activeCondition = 'NOVO';

  for (const line of lines) {
    const sectionCategory = detectCategory(line);
    if (isCategoryHeading(line, sectionCategory)) {
      activeCategory = sectionCategory;
      activeCondition = detectCondition(line);
      continue;
    }
    if (/\bcpo\b|refurbished|pre[-\s]?owned/i.test(line)) {
      activeCondition = 'CPO';
    } else if (/seminovo|semi\s?novo|usado|vitrine|open box/i.test(line)) {
      activeCondition = 'SEMINOVO';
    }

    if (PRODUCT_MARKERS.test(line) || isImplicitProductHeading(line, activeCategory)) {
      currentProduct = withCategoryPrefix(removePrice(line), activeCategory);
    }

    const price = extractPrice(line);
    if (price === null || !currentProduct) continue;

    const productName = removePrice(currentProduct);
    const color = extractColor(line) ?? extractColor(productName);
    const nameWithoutColor = color ? removeColor(productName, color) : productName;
    const normalizedName = normalizeProductText(nameWithoutColor);

    if (!normalizedName) continue;

    items.push({
      productName: nameWithoutColor,
      normalizedName,
      category: detectCategory(productName) ?? activeCategory,
      model: extractModel(productName),
      capacity: extractCapacity(productName),
      color,
      condition: detectCondition(productName) === 'NOVO' ? activeCondition : detectCondition(productName),
      price,
      availability: null,
      rawLine: line,
    });
  }

  return deduplicateItems(items);
}

function isCategoryHeading(value: string, category: string | null) {
  if (!category) return false;
  return !hasPrice(value) && !/\b\d+\s*(?:gb|tb|mm|inch|in)\b/i.test(value) && value.length < 60;
}

function isImplicitProductHeading(value: string, category: string | null) {
  if (!category || hasPrice(value)) return false;
  if (extractColor(value)) return false;
  return /\b(?:1[3-7]|17e|ultra\s?\d|s\d+|se\s?\d)\b/i.test(value);
}

function withCategoryPrefix(value: string, category: string | null) {
  if (!category || detectCategory(value)) return value;
  return `${category} ${value}`;
}

export function normalizeProductText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:apple|original|lacrado|esim|wifi|w\/?|garantia|anatel|lla|jp|hn)\b/g, ' ')
    .replace(/(\d+)\s*(gb|tb|ram|inch|in|polegadas?)/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function cleanLine(line: string) {
  return line
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removePrice(value: string) {
  const match = findPriceMatch(value);
  if (!match || match.index === undefined) return value.replace(/\s+/g, ' ').trim();

  return `${value.slice(0, match.index)}${value.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrice(value: string): number | null {
  const raw = findPriceMatch(value)?.[1];
  return raw ? parseMonetaryValue(raw) : null;
}

function findPriceMatch(value: string) {
  return value.match(PRICE_PREFIX) ?? value.match(PRICE_SUFFIX);
}

function hasPrice(value: string) {
  return findPriceMatch(value) !== null;
}

function parseMonetaryValue(value: string): number | null {
  const compact = value.replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(compact)) return null;

  const separators = [...compact.matchAll(/[.,]/g)].map((match) => match.index ?? -1);
  if (separators.length === 0) return toPositiveNumber(compact);

  const lastSeparatorIndex = Math.max(...separators);
  const decimalSeparator = compact[lastSeparatorIndex];
  if (!decimalSeparator) return null;
  const fractional = compact.slice(lastSeparatorIndex + 1);
  const integer = compact.slice(0, lastSeparatorIndex);

  if (fractional.length <= 2 && isValidGroupedInteger(integer, decimalSeparator)) {
    return toPositiveNumber(`${integer.replace(/[.,]/g, '')}.${fractional}`);
  }

  if (fractional.length === 3 && isValidGroupedInteger(compact, '')) {
    return toPositiveNumber(compact.replace(/[.,]/g, ''));
  }

  return null;
}

function isValidGroupedInteger(value: string, decimalSeparator: string) {
  if (!value || !/^\d[\d.,]*$/.test(value)) return false;

  const groupingSeparators = [...new Set([...value].filter((character) => character === '.' || character === ','))];
  if (groupingSeparators.length === 0) return /^\d+$/.test(value);
  if (groupingSeparators.length !== 1 || groupingSeparators[0] === decimalSeparator) return false;

  const separator = groupingSeparators[0];
  if (!separator) return false;
  const groups = value.split(separator);
  return groups.length > 1 && /^\d{1,3}$/.test(groups[0] ?? '') && groups.slice(1).every((group) => /^\d{3}$/.test(group));
}

function toPositiveNumber(value: string) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 9_999_999_999.99 ? price : null;
}

function detectCategory(value: string): string | null {
  if (/iphone/i.test(value)) return 'iPhone';
  if (/ipad/i.test(value)) return 'iPad';
  if (/mac\s?book|macbook/i.test(value)) return 'MacBook';
  if (/mac\s?mini/i.test(value)) return 'Mac Mini';
  if (/imac/i.test(value)) return 'iMac';
  if (/watch|ultra|\bse\d/i.test(value)) return 'Apple Watch';
  if (/air\s?pods|airpods|earpods/i.test(value)) return 'AirPods';
  if (/airtag|pencil|magic\s?mouse/i.test(value)) return 'Acessorio Apple';
  return null;
}

function extractModel(value: string): string | null {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact || null;
}

function extractCapacity(value: string): string | null {
  const match = value.match(/\b(\d+)\s*(GB|TB)\b/i);
  return match?.[1] && match[2] ? `${match[1]}${match[2].toUpperCase()}` : null;
}

function extractColor(value: string): string | null {
  const normalized = normalizeProductText(value);
  return COLOR_MARKERS.find((color) => normalized.includes(normalizeProductText(color))) ?? null;
}

function removeColor(value: string, color: string) {
  return value.replace(new RegExp(color.replace(/\s/g, '\\s+'), 'ig'), ' ').replace(/\s+/g, ' ').trim();
}

function detectCondition(value: string): string {
  if (/\bcpo\b|refurbished|pre[-\s]?owned/i.test(value)) return 'CPO';
  if (/seminovo|semi\s?novo|usado|vitrine|open box/i.test(value)) return 'SEMINOVO';
  return 'NOVO';
}

function deduplicateItems(items: ParsedSupplierListItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.normalizedName}|${item.color ?? ''}|${item.price}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
