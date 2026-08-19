import {
  canonicalModelRegistry,
  type CanonicalModelRegistryEntry,
} from './canonical-model-registry';

export interface CanonicalProductSource {
  productDescription?: string | null;
  productName?: string | null;
  category?: string | null;
  model?: string | null;
  color?: string | null;
  capacity?: string | null;
  quality?: string | null;
  productType?: string | null;
  notes?: string | null;
}

export interface CanonicalProductIdentity {
  canonicalCategory: string;
  canonicalModelKey: string;
  canonicalModelLabel: string;
  canonicalModelMatched: boolean;
  canonicalModelConfidence: number;
  canonicalModelMatchMethod: 'exact_alias' | 'deterministic' | 'unclassified';
  canonicalCondition: string;
  canonicalRam: string | null;
  canonicalStorage: string | null;
  canonicalColor: string | null;
  canonicalScreen: string | null;
  canonicalScreenSource: CanonicalAttributeSource;
  canonicalConnectivity: string | null;
  canonicalConnectivitySource: CanonicalAttributeSource;
  canonicalChip: string | null;
}

export type CanonicalAttributeSource = 'explicit' | 'model_invariant' | 'safe_default' | 'unknown';

export const canonicalColorAliases = [
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

export function normalizeCanonicalProductIdentity(
  input: CanonicalProductSource | string,
): CanonicalProductIdentity {
  const source: CanonicalProductSource = typeof input === 'string' ? { productName: input } : input;
  const preferredText = firstMeaningfulText(
    source.productDescription,
    source.productName,
    source.model,
  );
  const identityText = normalizeCanonicalText(
    [preferredText, source.category, source.model].filter(Boolean).join(' '),
  );
  const attributeText = normalizeCanonicalText(
    [
      source.productDescription,
      source.productName,
      source.model,
      source.capacity,
      source.color,
      source.quality,
      source.productType,
      source.notes,
    ]
      .filter(Boolean)
      .join(' '),
  );
  const inferredCategory = resolveCategory(identityText);
  const explicitScreen = resolveScreen(identityText, inferredCategory);
  const explicitChip = resolveChip(identityText);
  const modelResolution = resolveCanonicalModel({
    text: identityText,
    category: inferredCategory,
    screen: explicitScreen,
    chip: explicitChip,
  });
  const canonicalCategory = modelResolution.entry?.category ?? inferredCategory;
  const canonicalScreen = explicitScreen ?? modelResolution.entry?.invariants?.screen ?? null;
  const canonicalScreenSource: CanonicalAttributeSource = explicitScreen
    ? 'explicit'
    : modelResolution.entry?.invariants?.screen
      ? 'model_invariant'
      : 'unknown';
  const canonicalRam = resolveRam(attributeText, canonicalCategory);
  const canonicalStorage = resolveStorage(attributeText, canonicalRam, canonicalCategory);
  const explicitConnectivity = resolveConnectivity(attributeText, canonicalCategory);
  const canonicalConnectivity =
    explicitConnectivity ?? modelResolution.entry?.safeDefaults?.connectivity ?? null;
  const canonicalConnectivitySource: CanonicalAttributeSource = explicitConnectivity
    ? 'explicit'
    : modelResolution.entry?.safeDefaults?.connectivity
      ? 'safe_default'
      : 'unknown';
  const canonicalColor = resolveColor(normalizeCanonicalText(source.color || attributeText));
  const canonicalCondition = resolveCondition(attributeText);
  const canonicalChip = explicitChip ?? modelResolution.entry?.invariants?.chip ?? null;

  return {
    canonicalCategory,
    canonicalModelKey: modelResolution.entry?.key ?? '',
    canonicalModelLabel: modelResolution.entry?.label ?? '',
    canonicalModelMatched: Boolean(modelResolution.entry),
    canonicalModelConfidence: modelResolution.confidence,
    canonicalModelMatchMethod: modelResolution.matchMethod,
    canonicalCondition,
    canonicalRam,
    canonicalStorage,
    canonicalColor,
    canonicalScreen,
    canonicalScreenSource,
    canonicalConnectivity,
    canonicalConnectivitySource,
    canonicalChip,
  };
}

export function normalizeCanonicalText(value: string | null | undefined) {
  return (value ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, ' ')
    .replace(/\*|~|`/g, ' ')
    .replace(/\b\d{1,2}[\s/.-]+\d{1,2}[\s/.-]+20\d{2}\b/g, ' ')
    .replace(/\br\$?\s*\d[\d.,]*\b|\$\s*\d[\d.,]*/g, ' ')
    .replace(/[|_()[\]{}:;,+-]/g, ' ')
    .replace(/\b(\d+)\s*(gb|tb|mm)\b/g, '$1$2')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:inch|inches|polegadas?)\b/g, '$1inch')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface CanonicalModelResolution {
  entry: CanonicalModelRegistryEntry | null;
  confidence: number;
  matchMethod: CanonicalProductIdentity['canonicalModelMatchMethod'];
}

function resolveCanonicalModel({
  text,
  category,
  screen,
  chip,
}: {
  text: string;
  category: string;
  screen: string | null;
  chip: string | null;
}): CanonicalModelResolution {
  const exactAlias = resolveRegistryAlias(text);
  if (exactAlias === 'conflict') {
    return { entry: null, confidence: 0, matchMethod: 'unclassified' };
  }
  if (exactAlias) {
    return hasInvariantConflict(exactAlias, screen, chip)
      ? { entry: null, confidence: 0, matchMethod: 'unclassified' }
      : { entry: exactAlias, confidence: 1, matchMethod: 'exact_alias' };
  }

  const deterministicLabel = deriveDeterministicModelLabel({ text, category, screen, chip });
  const deterministicEntry = canonicalModelRegistry.find(
    (entry) => normalizeCanonicalText(entry.label) === normalizeCanonicalText(deterministicLabel),
  );

  if (deterministicEntry) {
    return hasInvariantConflict(deterministicEntry, screen, chip)
      ? { entry: null, confidence: 0, matchMethod: 'unclassified' }
      : { entry: deterministicEntry, confidence: 0.95, matchMethod: 'deterministic' };
  }

  return { entry: null, confidence: 0, matchMethod: 'unclassified' };
}

function hasInvariantConflict(
  entry: CanonicalModelRegistryEntry,
  explicitScreen: string | null,
  explicitChip: string | null,
) {
  return (
    (explicitScreen !== null &&
      entry.invariants?.screen !== undefined &&
      normalizeCanonicalText(explicitScreen) !== normalizeCanonicalText(entry.invariants.screen)) ||
    (explicitChip !== null &&
      entry.invariants?.chip !== undefined &&
      normalizeCanonicalText(explicitChip) !== normalizeCanonicalText(entry.invariants.chip))
  );
}

function resolveRegistryAlias(text: string): CanonicalModelRegistryEntry | 'conflict' | null {
  const matches = canonicalModelRegistry.flatMap((entry) =>
    entry.aliases
      .map(normalizeCanonicalText)
      .filter((alias) => alias && containsPhrase(text, alias))
      .map((alias) => ({ entry, score: alias.length })),
  );

  if (!matches.length) return null;

  const categories = new Set(matches.map(({ entry }) => entry.category));
  if (categories.size > 1) return 'conflict';

  const bestScore = Math.max(...matches.map(({ score }) => score));
  const bestEntries = new Map(
    matches
      .filter(({ score }) => score === bestScore)
      .map(({ entry }) => [entry.key, entry]),
  );

  return bestEntries.size === 1 ? ([...bestEntries.values()][0] ?? null) : 'conflict';
}

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim()) ?? '';
}

function resolveCategory(text: string) {
  if (/\b(?:iphone|iph)\b|\biph\s*\d|\biphone\s*\d/.test(text)) return 'iPhone';
  if (/\bipad\b/.test(text)) return 'iPad';
  if (/\bimac\b/.test(text)) return 'iMac';
  if (/\bmac\s+studio\b/.test(text)) return 'Mac Studio';
  if (/\bmacbook\b|\bmac\s+(?:air|pro|neo|mini)\b/.test(text)) return 'MacBook';
  if (/\bapple\s*watch\b|\bwatch\b|\b(?:series\s*\d+|s\s*\d+|se\s*\d+|ultra\s*\d+)\s+\d{2}(?:mm)?\b/.test(text)) {
    return 'Apple Watch';
  }
  if (/\bair\s*pods?\b|\bairpods?\b|\bairtag\b|\bpencil\b|\bmagic\s+(?:mouse|keyboard)\b|\bearpods?\b|\bcabo\b|\bfonte\b|\bcarregador\b/.test(text)) {
    return 'Acessorios';
  }
  return 'Eletronicos';
}

function deriveDeterministicModelLabel({
  text,
  category,
  screen,
  chip,
}: {
  text: string;
  category: string;
  screen: string | null;
  chip: string | null;
}) {
  const iphone = text.match(/\b(?:iphone|iph)\s*(\d{1,2})\s*(pro\s*max|promax|pm|pro|plus|air|e)?\b/)
    ?? (category === 'iPhone'
      ? text.match(/\b(1[1-9])\s*(pro\s*max|promax|pm|pro|plus|air|e)?\b/)
      : null);
  if (iphone) {
    const variant = normalizeIphoneVariant(iphone[2] ?? '');
    return `iPhone ${iphone[1]}${variant ? ` ${variant}` : ''}`;
  }

  if (category === 'Apple Watch') {
    const ultra = text.match(/\bultra\s*(\d+)?(?:\s+(\d{2})(?:mm)?)?/);
    if (ultra) return joinLabel('Apple Watch Ultra', ultra[1], watchSize(ultra[2], screen));

    const se = text.match(/\bse\s*(\d+)(?:\s+(\d{2})(?:mm)?)?/);
    if (se) return joinLabel('Apple Watch SE', se[1], watchSize(se[2], screen));

    const series = text.match(/\b(?:series|s)\s*(\d+)(?:\s+(\d{2})(?:mm)?)?/);
    if (series) return joinLabel('Apple Watch Series', series[1], watchSize(series[2], screen));
  }

  const macMini = text.match(/\bmac\s*mini\b/);
  if (macMini) return joinLabel('Mac Mini', chip);

  if (/\bimac\b/.test(text)) return joinLabel('iMac', chip, screen);
  if (/\bmac\s*studio\b/.test(text)) return joinLabel('Mac Studio', chip);

  const macbook = text.match(/\b(?:macbook|mac)\s*(air|pro|neo)\b/);
  if (macbook?.[1]) {
    const family = titleWord(macbook[1]);
    return joinLabel('MacBook', family, chip, screen);
  }

  const ipad = text.match(/\bipad\s*(pro|air|mini)?\s*(m\d+|a\d+)?\b/);
  if (ipad) {
    const family = ipad[1] ? titleWord(ipad[1]) : '';
    const ipadChip = ipad[2]?.toUpperCase() ?? '';
    if (!family && !ipadChip) {
      const generation = text.match(/\bipad\s+(\d{1,2})\b/)?.[1];
      return joinLabel('iPad', generation);
    }
    return joinLabel('iPad', family, ipadChip, screen);
  }

  const airpods = text.match(/\bair\s*pods?\s*(pro|max)?\s*(\d+)?\b|\bairpods?\s*(pro|max)?\s*(\d+)?\b/);
  if (airpods) {
    const variant = airpods[1] ?? airpods[3];
    const generation = airpods[2] ?? airpods[4];
    return joinLabel('AirPods', variant ? titleWord(variant) : '', generation);
  }

  if (/\b(?:apple\s*)?pencil\s*pro\b/.test(text)) return 'Apple Pencil Pro';
  const pencil = text.match(/\b(?:apple\s*)?pencil\s*(\d+|usb\s*c)?\b/);
  if (pencil) return joinLabel('Apple Pencil', pencil[1]?.replace(/\s+/g, '-').toUpperCase());

  const magicMouse = text.match(/\bmagic\s*mouse\s*(\d+)?\b/);
  if (magicMouse) return joinLabel('Magic Mouse', magicMouse[1]);
  if (/\bmagic\s*keyboard\b/.test(text)) return 'Magic Keyboard';
  if (/\bear\s*pods?\b|\bearpods?\b/.test(text)) return 'EarPods';

  return '';
}

function resolveRam(text: string, category: string) {
  const explicit = text.match(/\b(\d{1,3})gb\s*(?:ram|memory|memoria)\b|\b(\d{1,3})\s*ram\b/);
  const slash = text.match(/\b(\d{1,3})\s*\/\s*(\d{2,4})\b/);
  const memoryCandidates = Array.from(text.matchAll(/\b(\d{1,3})gb\b/g), (match) => Number(match[1]));
  const abbreviated = resolveMacBookAbbreviatedMemory(text, category);
  const inferred = ['MacBook', 'iMac', 'Mac Studio'].includes(category)
    ? memoryCandidates.find((value) => value <= 64)
    : undefined;
  const value = explicit?.[1] ?? explicit?.[2] ?? slash?.[1] ?? inferred;
  if (value) return `${Number(value)}GB`;
  return abbreviated?.ram ?? null;
}

function resolveStorage(text: string, ram: string | null, category: string) {
  const slash = text.match(/\b\d{1,3}\s*\/\s*(\d{2,4})\b/);
  if (slash?.[1]) return `${Number(slash[1])}GB`;

  const terabytes = text.match(/\b([1248])tb\b/);
  if (terabytes?.[1]) return `${terabytes[1]}TB`;

  const candidates = Array.from(text.matchAll(/\b(\d{2,4})gb\b/g), (match) => Number(match[1]));
  const ramValue = ram ? Number(ram.replace('GB', '')) : null;
  const storage = candidates.find((value) => value !== ramValue || candidates.length === 1 && value >= 64);
  if (storage) return `${storage}GB`;

  return resolveMacBookAbbreviatedMemory(text, category)?.storage ?? null;
}

function resolveMacBookAbbreviatedMemory(text: string, category: string) {
  if (category !== 'MacBook') return null;

  const tokens = text.split(' ').filter(Boolean);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const ram = parseMacBookRamToken(tokens[index]);
    const storage = parseMacBookStorageToken(tokens[index + 1]);
    if (ram && storage) return { ram, storage };
  }

  return null;
}

function parseMacBookRamToken(token: string | undefined) {
  if (!token) return null;
  const normalized = token.toLowerCase();
  const explicit = normalized.match(/^(8|16|18|24|32|36|48|64)(?:gb|g)$/);
  const bare = normalized.match(/^(8|16|18|24|32|36|48|64)$/);
  const value = explicit?.[1] ?? bare?.[1];
  return value ? `${Number(value)}GB` : null;
}

function parseMacBookStorageToken(token: string | undefined) {
  if (!token) return null;
  const normalized = token.toLowerCase();
  const terabytes = normalized.match(/^(1|2|4|8)tb$/);
  if (terabytes?.[1]) return `${terabytes[1]}TB`;

  const gigabytes = normalized.match(/^(64|128|256|512|1024|2048|4096|8192)(?:gb)?$/);
  return gigabytes?.[1] ? `${Number(gigabytes[1])}GB` : null;
}

function resolveScreen(text: string, category: string) {
  if (category === 'Apple Watch') {
    const size = text.match(/\b(3[89]|4[02469])mm\b/)?.[1];
    return size ? `${size}mm` : null;
  }
  const sizePattern = category === 'iMac'
    ? '(?:1[7-9]|2[0-9]|3[0-2])'
    : '1[0-6]';
  const explicitMatch = text.match(
    new RegExp(`\\b(${sizePattern}(?:\\.\\d+)?)inch\\b|\\b(${sizePattern}(?:\\.\\d+)?)\\s*["”]`),
  );
  const explicit = explicitMatch?.[1] ?? explicitMatch?.[2];
  if (explicit) return `${explicit.replace(/\.\d$/, '')}"`;
  if (category === 'MacBook' || category === 'iMac' || /\bipad\s+(?:air|pro|mini)\b/.test(text)) {
    const contextualSizePattern = category === 'iMac'
      ? '(?:1[7-9]|2[0-9]|3[0-2])'
      : '1[0-6]';
    const contextual = text.match(
      new RegExp(`\\b(?:m\\d+(?:\\s+(?:pro|max|ultra))?|air|pro|neo)\\s+(${contextualSizePattern}(?:\\.\\d+)?)\\b`),
    )?.[1];
    if (contextual) return `${contextual.replace(/\.\d$/, '')}"`;
  }
  return null;
}

function resolveConnectivity(text: string, category: string) {
  const cellular = /\bcellular\b|\bcom\s+cel(?:ular)?\b/.test(text);
  if (/\bgps\s*(?:\+|e|and)?\s*cellular\b|\bgps\s*cell\b/.test(text)) return 'GPS + Cellular';
  if (cellular && category === 'Apple Watch') return 'GPS + Cellular';
  if (cellular && category === 'iPad') return 'Wi-Fi + Cellular';
  if (cellular) return 'Cellular';
  if (/\bgps\b/.test(text)) return 'GPS';
  if (/\be\s*sim\b|\besim\b/.test(text)) return 'eSIM';
  if (/\bwi\s*fi\b|\bwifi\b/.test(text)) return 'Wi-Fi';
  return null;
}

function resolveChip(text: string) {
  const chip = text.match(/\b([ma]\d+)\s*(pro|max|ultra)?\b/);
  if (!chip?.[1]) return null;
  return joinLabel(chip[1].toUpperCase(), chip[2] ? titleWord(chip[2]) : '');
}

function resolveColor(text: string) {
  const definition = canonicalColorAliases.find((alias) =>
    alias.terms.some((term) => containsTerm(text, term)),
  );
  return definition?.value ?? null;
}

function resolveCondition(text: string) {
  if (/\bcpo\b|certified pre owned|refurbished/.test(text)) return 'CPO';
  if (/seminovo|semi novo|usado|vitrine|open box|swap/.test(text)) return 'Seminovo';
  return 'Novo';
}

function normalizeIphoneVariant(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (['promax', 'pro max', 'pm'].includes(normalized)) return 'Pro Max';
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'plus') return 'Plus';
  if (normalized === 'air') return 'Air';
  if (normalized === 'e') return 'e';
  return '';
}

function watchSize(value: string | undefined, fallback: string | null) {
  return value ? `${value}mm` : fallback?.endsWith('mm') ? fallback : null;
}

function joinLabel(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function titleWord(value: string) {
  if (/^[ma]\d+$/i.test(value)) return value.toUpperCase();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`).test(text);
}

function containsPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?=$|[^a-z0-9])`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
