import { ParsedSupplierListItem } from './evolution-webhook.types';

const PRODUCT_MARKERS =
  /\b(iph(?:one)?\s*\d|ipad|mac\s?book|macbook|mac\s?mini|imac|watch|airpods|air\s?pods|airtag|pencil|magic\s?mouse|earpods)\b/i;
const PRODUCT_IDENTITY_MARKERS =
  /(?:\b(?:produto|dispositivo|garmin|fenix|forerunner|venu|dji|drone|xiaomi|redmi|poco|realme|motorola|moto|huawei|infinix|honor|samsung|galaxy|nintendo|switch|vacuum|aspirador|backbone|fire\s?tv|cabo|fonte|carregador|capa|teclado|keyboard|mouse)\b|\busb[-\s]?c\s*\/)/i;
const USED_CONDITION_MARKERS =
  /\b(?:seminovo|semi\s?novo|usado|vitrine|open\s?box|as[-\s]?is|no\s?active|not\s?active|never\s?activ(?:e|ated)|nunca\s?(?:active|ativado)|nao\s?ativado|não\s?ativado)\b/i;
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
  'lavender',
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
  let currentCondition = 'NOVO';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const nextLine = lines[index + 1] ?? null;
    if (isContextBoundaryLine(line)) {
      currentProduct = null;
      currentCondition = activeCondition;
      continue;
    }
    const sectionCategory = detectCategory(line);
    if (isCategoryHeading(line, sectionCategory)) {
      activeCategory = sectionCategory;
      activeCondition = detectCondition(line);
      currentProduct = null;
      currentCondition = activeCondition;
      continue;
    }

    if (isConditionDescriptor(line)) {
      currentCondition = detectCondition(line);
      if (!currentProduct) activeCondition = currentCondition;
      continue;
    }

    if (isConditionSectionHeading(line)) {
      activeCondition = detectCondition(line);
      currentCondition = activeCondition;
      currentProduct = null;
      continue;
    }

    if (isProductHeading(line, activeCategory, currentProduct !== null, nextLine)) {
      currentProduct = withCategoryPrefix(removePrice(line), activeCategory);
      const productCondition = detectCondition(currentProduct);
      currentCondition = productCondition === 'NOVO' ? activeCondition : productCondition;
    }

    const price = extractPrice(line);
    if (price === null || !currentProduct) continue;

    const productName = canonicalizeProductName(removePrice(currentProduct));
    const color = extractColor(line) ?? extractColor(productName);
    const nameWithoutColor = color ? removeColor(productName, color) : productName;
    const normalizedName = normalizeProductText(nameWithoutColor);

    if (!normalizedName) continue;

    items.push({
      productName: nameWithoutColor,
      normalizedName,
      category:
        detectCategory(productName) ??
        (PRODUCT_IDENTITY_MARKERS.test(productName) ? null : activeCategory),
      model: extractModel(productName),
      capacity: extractCapacity(productName),
      color,
      condition: currentCondition,
      price,
      availability: null,
      rawLine: line,
    });
  }

  return deduplicateItems(items);
}

export function isValidParsedSupplierListSnapshot(items: ParsedSupplierListItem[]) {
  return (
    items.length > 0 &&
    items.every((item) => {
      const rawLinePrice = extractPrice(item.rawLine);
      return (
        item.productName.trim().length > 0 &&
        item.normalizedName.trim().length > 0 &&
        rawLinePrice !== null &&
        rawLinePrice === item.price
      );
    })
  );
}

function isCategoryHeading(value: string, category: string | null) {
  if (!category) return false;
  if (/\b(?:pencil|airtag|magic\s?mouse|earpods)\b/i.test(value)) return false;
  if (/\bair\s?pods\s+(?:pro|max|regular|anc)\b/i.test(value)) return false;
  if (/\b(?:watch\s+)?(?:se|series|ultra|s\d+)\b/i.test(value)) return false;
  return !hasPrice(value) && !/\b\d+\b/.test(value) && value.length < 60;
}

function isProductHeading(
  value: string,
  category: string | null,
  hasCurrentProduct: boolean,
  nextLine: string | null,
) {
  const candidate = removePrice(value);
  if (!candidate) return false;
  const hasProductIdentity =
    PRODUCT_MARKERS.test(candidate) || PRODUCT_IDENTITY_MARKERS.test(candidate);
  if (isNonProductText(candidate) && !hasProductIdentity) return false;
  if (isAttributeOnlyLine(candidate) && !hasProductIdentity) return false;

  if (hasPrice(value) && detectCategory(candidate)) return true;

  if (
    PRODUCT_MARKERS.test(candidate) ||
    PRODUCT_IDENTITY_MARKERS.test(candidate) ||
    isImplicitProductHeading(candidate, category)
  ) {
    return true;
  }

  return hasPrice(value)
    ? isUnknownProductQuote(candidate, hasCurrentProduct)
    : isUnknownProductHeading(candidate, nextLine);
}

function isImplicitProductHeading(value: string, category: string | null) {
  if (!category || hasPrice(value)) return false;
  if (extractColor(value)) return false;
  return /\b(?:1[3-7]|17e|ultra\s?\d|s\d+|se\s?\d)\b/i.test(value);
}

function isUnknownProductHeading(value: string, nextLine: string | null) {
  if (extractColor(value) || isNonProductText(value)) return false;
  const words = normalizeProductText(value).split(' ').filter(Boolean);
  return (
    words.length >= 2 &&
    (hasTechnicalSpecifier(value) ||
      looksLikeNamedProduct(value) ||
      (nextLine !== null && hasPrice(nextLine)))
  );
}

function isUnknownProductQuote(value: string, hasCurrentProduct: boolean) {
  if (extractColor(value) || isNonProductText(value)) return false;
  const words = normalizeProductText(value).split(' ').filter(Boolean);
  if (words.length < 2) return false;
  if (hasCurrentProduct) return looksLikeNamedProduct(value) || words.length >= 2;
  return hasTechnicalSpecifier(value) || looksLikeNamedProduct(value) || words.length >= 3;
}

function looksLikeNamedProduct(value: string) {
  return (
    PRODUCT_IDENTITY_MARKERS.test(value) ||
    /\b[a-z]{2,}\s+[a-z]*\d+[a-z0-9-]*\b/i.test(value) ||
    /\bproduto\s+[a-z0-9]/i.test(value)
  );
}

function hasTechnicalSpecifier(value: string) {
  return /\b\d+\s*(?:gb|tb|ram|mm|inch|in|polegadas?|w)\b|\b\d+\s*[+/]\s*\d+\b/i.test(value);
}

function isConditionDescriptor(value: string) {
  const withoutCondition = value
    .replace(USED_CONDITION_MARKERS, ' ')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/\b(?:bateria|battery)?\s*100\s*%?\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return USED_CONDITION_MARKERS.test(value) && withoutCondition.length === 0;
}

function isConditionSectionHeading(value: string) {
  const hasCondition =
    /\bcpo\b|refurbished|pre[-\s]?owned/i.test(value) || USED_CONDITION_MARKERS.test(value);
  return (
    hasCondition &&
    !hasPrice(value) &&
    !PRODUCT_MARKERS.test(value) &&
    !PRODUCT_IDENTITY_MARKERS.test(value) &&
    !hasTechnicalSpecifier(value)
  );
}

function isAttributeOnlyLine(value: string) {
  if (extractColor(value)) return false;
  return (
    /\b(?:cpu|gpu|ram|ssd|chip\s+(?:fisico|físico|virtual)|bateria|battery|controle|oculos|óculos|ocean\s+band|alpine\s+loop|pulseira|solar|sapphire|garantia|meses?|dias?|minutos?|unidades?|pecas?|peças?)\b/i.test(
      value,
    ) ||
    /^\s*\d+\s*(?:c\s*)?(?:cpu|gpu|baterias?)\b/i.test(value) ||
    /^\s*modelo\s+[a-z]?\d+[a-z0-9-]*\s*$/i.test(value)
  );
}

function isNonProductText(value: string) {
  if (/^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s|$)/.test(value)) return true;
  if (/^\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s|$)/.test(value)) return true;
  return /\b(?:atencao|atencao|garantia|correios|transportadora|nota fiscal|pagamento|conta|horario|obrigado|boas vendas|lista atualizada|disponivel|estoque)\b/i.test(
    value,
  );
}

function isContextBoundaryLine(value: string) {
  if (hasPrice(value)) return false;
  return (
    /^\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s|$)/.test(value) ||
    /^\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s|$)/.test(value) ||
    /\b(?:ultima\s+chamada|última\s+chamada|lista\s+atualizada|bom\s+dia|boa\s+tarde|boa\s+noite|aviso)\b/i.test(
      value,
    )
  );
}

function withCategoryPrefix(value: string, category: string | null) {
  if (!category || detectCategory(value) || PRODUCT_IDENTITY_MARKERS.test(value)) return value;
  return `${category} ${value}`;
}

export function normalizeProductText(value: string): string {
  return canonicalizeProductName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:apple|original|lacrado|garantia)\b/g, ' ')
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

function canonicalizeProductName(value: string) {
  const withoutDecorations = value
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[•|_~*]+/g, ' ')
    .replace(/\b(?:oferta|promocao|promocao|disponivel|estoque|lista atualizada)\b/gi, ' ')
    .replace(
      /\b(?:cpo|refurbished|pre[-\s]?owned|seminovo|semi\s?novo|usado|vitrine|open box)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, '')
    .replace(/\biph(?:one)?\s*(?=\d)/gi, 'iPhone ')
    .replace(/\bair\s*pods\b/gi, 'AirPods')
    .replace(/\bmac\s*book\b/gi, 'MacBook')
    .replace(/\bmac\s*mini\b/gi, 'Mac Mini')
    .replace(/\bipad\b/gi, 'iPad')
    .replace(/\bimac\b/gi, 'iMac')
    .replace(/\bapple\s*watch\b/gi, 'Apple Watch')
    .replace(
      /\b(\d+)\s*(gb|tb|ram|mm)\b/gi,
      (_, value: string, unit: string) => `${value}${unit.toUpperCase()}`,
    )
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:inch|in|polegadas?)\b/gi, '$1"')
    .replace(/\s+/g, ' ')
    .trim();

  return withoutDecorations
    .split(' ')
    .filter(Boolean)
    .map((token) => formatProductToken(token))
    .join(' ');
}

function formatProductToken(token: string) {
  const lower = token.toLowerCase();
  const known = new Map([
    ['iphone', 'iPhone'],
    ['ipad', 'iPad'],
    ['imac', 'iMac'],
    ['macbook', 'MacBook'],
    ['airpods', 'AirPods'],
    ['usb-c', 'USB-C'],
    ['usb', 'USB'],
    ['wifi', 'Wi-Fi'],
    ['e-sim', 'eSIM'],
    ['esim', 'eSIM'],
    ['gps', 'GPS'],
    ['cellular', 'Cellular'],
    ['ram', 'RAM'],
    ['ssd', 'SSD'],
    ['anc', 'ANC'],
    ['cpo', 'CPO'],
  ]);
  const canonical = known.get(lower);
  if (canonical) return canonical;
  if (/^m\d+(?:pro|max)?$/i.test(token)) return token.toUpperCase();
  if (/^\d+(?:gb|tb|ram|mm)$/i.test(token)) return token.toUpperCase();
  if (/^\d+(?:\.\d+)?"$/.test(token)) return token;
  if (/^[a-z]+$/i.test(token))
    return `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`;
  return token;
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

  const groupingSeparators = [
    ...new Set([...value].filter((character) => character === '.' || character === ',')),
  ];
  if (groupingSeparators.length === 0) return /^\d+$/.test(value);
  if (groupingSeparators.length !== 1 || groupingSeparators[0] === decimalSeparator) return false;

  const separator = groupingSeparators[0];
  if (!separator) return false;
  const groups = value.split(separator);
  return (
    groups.length > 1 &&
    /^\d{1,3}$/.test(groups[0] ?? '') &&
    groups.slice(1).every((group) => /^\d{3}$/.test(group))
  );
}

function toPositiveNumber(value: string) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 && price <= 9_999_999_999.99 ? price : null;
}

function detectCategory(value: string): string | null {
  if (/\biphones?\b|\biph(?:one)?\s*\d/i.test(value)) return 'iPhone';
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
  const match = [...value.matchAll(/\b(\d+)\s*(GB|TB)\b/gi)].at(-1);
  return match?.[1] && match[2] ? `${match[1]}${match[2].toUpperCase()}` : null;
}

function extractColor(value: string): string | null {
  const normalized = normalizeProductText(value);
  return COLOR_MARKERS.find((color) => normalized.includes(normalizeProductText(color))) ?? null;
}

function removeColor(value: string, color: string) {
  return value
    .replace(new RegExp(color.replace(/\s/g, '\\s+'), 'ig'), ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCondition(value: string): string {
  if (/\bcpo\b|refurbished|pre[-\s]?owned/i.test(value)) return 'CPO';
  if (USED_CONDITION_MARKERS.test(value)) return 'SEMINOVO';
  return 'NOVO';
}

function deduplicateItems(items: ParsedSupplierListItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.normalizedName}|${item.color ?? ''}|${item.price}|${item.condition ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
