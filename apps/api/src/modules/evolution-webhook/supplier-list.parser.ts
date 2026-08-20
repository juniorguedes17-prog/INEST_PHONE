import { ParsedSupplierListItem } from './evolution-webhook.types';

const PRODUCT_MARKERS =
  /\b(iph(?:one)?\s*\d|ipad|mac\s?book|macbook|mac\s?mini|imac|watch|airpods|air\s?pods|airtag|pencil|magic\s?mouse|earpods)\b/i;
const PRODUCT_IDENTITY_MARKERS =
  /(?:\b(?:produto|dispositivo|garmin|fenix|forerunner|venu|dji|drone|xiaomi|redmi|poco|realme|motorola|moto|huawei|infinix|honor|samsung|galaxy|nintendo|switch|vacuum|aspirador|backbone|fire\s?tv|cabo|fonte|carregador|capa|teclado|keyboard|mouse)\b|\busb[-\s]?c\s*\/)/i;
const USED_CONDITION_MARKERS =
  /\b(?:seminovo|semi\s?novo|usado|vitrine|open\s?box|as[-\s]?is|no\s?active|not\s?active|never\s?activ(?:e|ated)|nunca\s?(?:active|ativado)|nao\s?ativado|não\s?ativado)\b/i;
const GRADE_MARKER = /\bgrade\s*(a\s*\+|ab|b|c|a)(?=\s|[^a-z0-9]|$)/gi;
const CURRENCY_MARKER = String.raw`(?:R\$|\$R|\$|\u{1F4B0}|\u{1F4B2}|\u{1F4B5})`;
const MONEY_VALUE = String.raw`\d(?:[\d.,]|\s(?=\d{3}(?:\D|$)))*`;
const PRICE_PREFIX = new RegExp(`${CURRENCY_MARKER}\\s*(${MONEY_VALUE})`, 'iu');
const PRICE_SUFFIX = new RegExp(`(${MONEY_VALUE})\\s*(?:R\\$|\\$R)`, 'iu');
const PRICE_BARE_SUFFIX = new RegExp(`(?:^|\\s)(${MONEY_VALUE})\\s*$`, 'iu');
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
  'amarelo',
  'citrus',
  'blush',
  'lavender',
];

export type SupplierLineRejectionReason =
  | 'invalid_or_missing_price'
  | 'missing_product_context'
  | 'empty_normalized_product';

export interface SupplierLineRejection {
  rawLine: string;
  reason: SupplierLineRejectionReason;
}

export interface ParseSupplierListOptions {
  onLineRejected?: (rejection: SupplierLineRejection) => void;
}

export function parseSupplierListText(
  content: string,
  options: ParseSupplierListOptions = {},
): ParsedSupplierListItem[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter(Boolean);
  const items: ParsedSupplierListItem[] = [];
  let currentProduct: string | null = null;
  let activeCategory: string | null = null;
  let activeCondition = 'NOVO';
  let currentCondition = 'NOVO';
  let activeGrade: ProductGrade | null = null;
  let currentGrade: ProductGrade | null = null;
  let pendingColors: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const nextLine = lines[index + 1] ?? null;
    if (isContextBoundaryLine(line)) {
      currentProduct = null;
      activeGrade = null;
      currentGrade = null;
      pendingColors = [];
      currentCondition = activeCondition;
      continue;
    }
    const sectionCategory = detectCategory(line);
    if (isCategoryHeading(line, sectionCategory)) {
      activeCategory = sectionCategory;
      activeCondition = detectCondition(line);
      currentProduct = null;
      activeGrade = null;
      currentGrade = null;
      pendingColors = [];
      currentCondition = activeCondition;
      continue;
    }

    if (isConditionDescriptor(line)) {
      currentCondition = detectCondition(line);
      pendingColors = [];
      if (!currentProduct) {
        activeCondition = currentCondition;
        activeGrade = null;
        currentGrade = null;
      }
      continue;
    }

    if (isConditionSectionHeading(line)) {
      activeCondition = detectCondition(line);
      currentCondition = activeCondition;
      currentProduct = null;
      activeGrade = null;
      currentGrade = null;
      pendingColors = [];
      continue;
    }

    const lineGrade = extractGrade(line);
    if (lineGrade && isGradeSectionHeading(line)) {
      activeGrade = lineGrade;
      currentGrade = activeGrade;
      currentProduct = null;
      pendingColors = [];
      continue;
    }

    const isGradeQualifier = Boolean(lineGrade && currentProduct && isGradeQualifierLine(line));
    const isProductCandidate =
      !isGradeQualifier && isProductHeading(line, activeCategory, currentProduct !== null, nextLine);
    if (isProductCandidate) {
      currentProduct = withCategoryPrefix(removePrice(line), activeCategory);
      pendingColors = [];
      currentGrade = lineGrade ?? activeGrade;
      const productCondition = detectCondition(currentProduct);
      currentCondition = productCondition === 'NOVO' ? activeCondition : productCondition;
    } else if (lineGrade && currentProduct) {
      currentGrade = lineGrade;
    }

    const lineColor = extractColor(line);
    const price = extractPrice(line, Boolean(currentProduct && lineColor));
    if (price === null) {
      if (currentProduct && lineColor && !isProductCandidate && isStandaloneColorLine(line)) {
        if (!pendingColors.includes(lineColor)) pendingColors.push(lineColor);
        continue;
      }
      if (pendingColors.length > 0) pendingColors = [];
      if (isProductCandidate && !hasPrice(nextLine ?? '') && !hasContextualBarePrice(nextLine ?? '')) {
        options.onLineRejected?.({ rawLine: line, reason: 'invalid_or_missing_price' });
      }
      continue;
    }
    if (!currentProduct) {
      options.onLineRejected?.({ rawLine: line, reason: 'missing_product_context' });
      continue;
    }

    const productName = canonicalizeProductName(removePrice(currentProduct));
    const colors = lineColor
      ? [lineColor]
      : pendingColors.length > 0
        ? [...pendingColors]
        : [extractColor(productName)];
    const nameWithoutColor = productName;
    const normalizedName = normalizeProductText(nameWithoutColor);

    if (!normalizedName) {
      options.onLineRejected?.({ rawLine: line, reason: 'empty_normalized_product' });
      continue;
    }

    if (currentGrade && !isEligibleGrade(currentGrade)) {
      pendingColors = [];
      continue;
    }

    for (const color of colors) {
      const itemName = color ? removeColor(nameWithoutColor, color) : nameWithoutColor;
      items.push({
        productName: itemName,
        normalizedName: normalizeProductText(itemName),
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
    pendingColors = [];
  }

  return deduplicateItems(items);
}

type ProductGrade = 'A' | 'A+' | 'AB' | 'B' | 'C';

function isGradeSectionHeading(value: string) {
  const grade = extractGrade(value);
  if (!grade || hasPrice(value)) return false;

  return removeGradeMarker(value)
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[()[\]{}:;,./\\|•*_~\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === '';
}

function isGradeQualifierLine(value: string) {
  if (!extractGrade(value)) return false;

  return removeGradeMarker(removePrice(value))
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[()[\]{}:;,./\\|•*_~\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() === '';
}

function extractGrade(value: string): ProductGrade | null {
  const matches = [...value.matchAll(GRADE_MARKER)]
    .map((match) => match[1])
    .filter((grade): grade is string => Boolean(grade))
    .map(normalizeGrade);
  if (matches.length !== 1) return null;
  return matches[0] ?? null;
}

function normalizeGrade(value: string): ProductGrade {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  return normalized === 'A+' ? 'A+' : (normalized as ProductGrade);
}

function removeGradeMarker(value: string) {
  return value.replace(GRADE_MARKER, ' ');
}

function isEligibleGrade(grade: ProductGrade) {
  return grade === 'A' || grade === 'A+';
}

export function isValidParsedSupplierListSnapshot(items: ParsedSupplierListItem[]) {
  return (
    items.length > 0 &&
    items.every((item) => {
      const rawLinePrice = extractPrice(item.rawLine, Boolean(item.color));
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
    PRODUCT_MARKERS.test(candidate) ||
    PRODUCT_IDENTITY_MARKERS.test(candidate) ||
    isCompactAppleProductHeading(candidate);
  if (isNonProductText(candidate) && !hasProductIdentity) return false;
  if (isAttributeOnlyLine(candidate) && !hasProductIdentity) return false;

  if (hasPrice(value) && detectCategory(candidate)) return true;

  if (
    PRODUCT_MARKERS.test(candidate) ||
    PRODUCT_IDENTITY_MARKERS.test(candidate) ||
    isCompactAppleProductHeading(candidate) ||
    isImplicitProductHeading(candidate, category)
  ) {
    return true;
  }

  return hasPrice(value)
    ? isUnknownProductQuote(candidate, hasCurrentProduct)
    : isUnknownProductHeading(candidate, nextLine);
}

function isCompactAppleProductHeading(value: string) {
  return /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]*(?:iphone\s*)?(?:1[2-7]|17e)\b[\s\S]*\b(?:pro|max|air|plus|e)\b/iu.test(
    value,
  );
}

function isStandaloneColorLine(value: string) {
  const normalized = normalizeProductText(value)
    .replace(/\b(?:prata|cinza|cinzento|gray|grey|yellow|spacegray|jetblack|skyblue|deepblue)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    normalized.length > 0 &&
    !/\d/.test(normalized) &&
    !PRODUCT_MARKERS.test(normalized) &&
    !PRODUCT_IDENTITY_MARKERS.test(normalized) &&
    !/\b(?:chip|cpu|gpu|ram|bateria|battery|garantia|modelo|estoque|unidade|unidades?)\b/i.test(
      normalized,
    ) &&
    normalized.split(' ').length <= 3
  );
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
    isSwapConditionHeading(value) ||
    /\bcpo\b|refurbished|pre[-\s]?owned/i.test(value) ||
    USED_CONDITION_MARKERS.test(value);
  return (
    hasCondition &&
    !hasPrice(value) &&
    !PRODUCT_MARKERS.test(value) &&
    !PRODUCT_IDENTITY_MARKERS.test(value) &&
    !hasTechnicalSpecifier(value)
  );
}

function isSwapConditionHeading(value: string) {
  const normalized = value
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return normalized === 'swap' || normalized === 'lista swap';
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
  if (!category || PRODUCT_IDENTITY_MARKERS.test(value)) return value;
  if (/^\s*iphone\b/i.test(value)) return value;
  if (isCompactAppleProductHeading(value)) return category === 'iPhone' ? `${category} ${value}` : value;
  if (detectCategory(value)) return value;
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
  const withoutGrade = extractGrade(value) ? removeGradeMarker(value) : value;
  const withoutDecorations = withoutGrade
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[•|_~*]+/g, ' ')
    .replace(/\(\s*\)/g, ' ')
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

function extractPrice(value: string, allowBarePrice = false): number | null {
  const raw = findPriceMatch(value, allowBarePrice)?.[1];
  return raw ? parseMonetaryValue(raw) : null;
}

function findPriceMatch(value: string, allowBarePrice = false) {
  return (
    value.match(PRICE_PREFIX) ??
    value.match(PRICE_SUFFIX) ??
    (allowBarePrice ? value.match(PRICE_BARE_SUFFIX) : null)
  );
}

function hasPrice(value: string, allowBarePrice = false) {
  return findPriceMatch(value, allowBarePrice) !== null;
}

function hasContextualBarePrice(value: string) {
  return Boolean(extractColor(value) && extractPrice(value, true) !== null);
}

function parseMonetaryValue(value: string): number | null {
  const compact = value.replace(/\s/g, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(compact)) return null;

  if (/^\d{1,3}(?:[.,]\d{3})+[.,]\d{2}$/.test(compact)) {
    const digits = compact.replace(/[.,]/g, '');
    return toPositiveNumber(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
  }

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
  if (isCompactAppleProductHeading(value)) return 'iPhone';
  if (/ipad/i.test(value)) return 'iPad';
  if (/mac\s?book|macbook/i.test(value)) return 'MacBook';
  if (/mac\s?mini/i.test(value)) return 'Mac Mini';
  if (/imac/i.test(value)) return 'iMac';
  if (/watch|ultra|\bse\d/i.test(value)) return 'Apple Watch';
  if (isAirPodsAccessory(value)) return 'Acessorio Apple';
  if (/air\s?pods|airpods/i.test(value)) return 'Fones';
  if (/earpods/i.test(value)) return 'Acessorio Apple';
  if (/airtag|pencil|magic\s?mouse/i.test(value)) return 'Acessorio Apple';
  return null;
}

function isAirPodsAccessory(value: string) {
  return /\b(?:capa|case|cord(?:a|ã)o|estojo|protetor)\b[\s\S]{0,32}\bair\s?pods?\b|\bair\s?pods?\b[\s\S]{0,32}\b(?:capa|case|cord(?:a|ã)o|estojo|protetor)\b/i.test(
    value,
  );
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
  if (isSwapConditionHeading(value)) return 'SEMINOVO';
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
