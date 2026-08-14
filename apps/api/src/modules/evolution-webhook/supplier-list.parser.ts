import { ParsedSupplierListItem } from './evolution-webhook.types';

const PRODUCT_MARKERS = /\b(iphone|ipad|mac\s?book|macbook|mac\s?mini|imac|watch|airpods|air\s?pods|airtag|pencil|magic\s?mouse|earpods)\b/i;
const PRICE_MARKER = /(?:R\$|💰|💲|\$)\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/i;
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
  return !PRICE_MARKER.test(value) && !/\b\d+\s*(?:gb|tb|mm|inch|in)\b/i.test(value) && value.length < 60;
}

function isImplicitProductHeading(value: string, category: string | null) {
  if (!category || PRICE_MARKER.test(value)) return false;
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
  return value.replace(PRICE_MARKER, '').replace(/\s+/g, ' ').trim();
}

function extractPrice(value: string): number | null {
  const match = value.match(PRICE_MARKER);
  const raw = match?.[1];
  if (!raw) return null;

  const normalized = raw.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
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
