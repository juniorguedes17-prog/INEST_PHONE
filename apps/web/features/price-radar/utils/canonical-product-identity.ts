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
  canonicalCondition: string;
  canonicalRam: string | null;
  canonicalStorage: string | null;
  canonicalColor: string | null;
  canonicalScreen: string | null;
  canonicalConnectivity: string | null;
  canonicalChip: string | null;
}

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

const promotionTerms = new Set([
  'atencao', 'atualizado', 'atualizada', 'bom', 'dia', 'estoque', 'fire', 'imperdivel',
  'lista', 'oferta', 'ofertas', 'promocao', 'promocoes', 'somente', 'ultima', 'chamada',
]);

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
  const canonicalCategory = resolveCategory(identityText);
  const canonicalRam = resolveRam(attributeText, canonicalCategory);
  const canonicalStorage = resolveStorage(attributeText, canonicalRam);
  const canonicalScreen = resolveScreen(identityText, canonicalCategory);
  const canonicalConnectivity = resolveConnectivity(attributeText);
  const canonicalChip = resolveChip(identityText);
  const canonicalColor = resolveColor(normalizeCanonicalText(source.color || attributeText));
  const canonicalCondition = resolveCondition(attributeText);
  const canonicalModelLabel = resolveModelLabel({
    text: identityText,
    category: canonicalCategory,
    screen: canonicalScreen,
    chip: canonicalChip,
  });

  return {
    canonicalCategory,
    canonicalModelKey: toCanonicalKey(canonicalModelLabel),
    canonicalModelLabel,
    canonicalCondition,
    canonicalRam,
    canonicalStorage,
    canonicalColor,
    canonicalScreen,
    canonicalConnectivity,
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
    .replace(/[|_()[\]{}:;,+]/g, ' ')
    .replace(/\b(\d+)\s*(gb|tb|mm)\b/g, '$1$2')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:inch|inches|polegadas?)\b/g, '$1inch')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function firstMeaningfulText(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim()) ?? '';
}

function resolveCategory(text: string) {
  if (/\b(?:iphone|iph)\b|\biph\s*\d|\biphone\s*\d/.test(text)) return 'iPhone';
  if (/\bipad\b/.test(text)) return 'iPad';
  if (/\bmacbook\b|\bmac\s+(?:air|pro|neo|mini)\b/.test(text)) return 'MacBook';
  if (/\bapple\s*watch\b|\bwatch\b|\b(?:series\s*\d+|s\s*\d+|se\s*\d+|ultra\s*\d+)\s+\d{2}(?:mm)?\b/.test(text)) {
    return 'Apple Watch';
  }
  if (/\bair\s*pods?\b|\bairpods?\b|\bairtag\b|\bpencil\b|\bmagic\s+(?:mouse|keyboard)\b|\bearpods?\b|\bcabo\b|\bfonte\b|\bcarregador\b/.test(text)) {
    return 'Acessorios';
  }
  return 'Eletronicos';
}

function resolveModelLabel({
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

  return buildProvisionalModelLabel(text);
}

function buildProvisionalModelLabel(text: string) {
  const colorTerms = canonicalColorAliases.flatMap((alias) => alias.terms);
  const removableTerms = new Set([
    ...promotionTerms,
    'americano', 'americana', 'anatel', 'cellular', 'esim', 'gps', 'jp', 'lla', 'wifi',
    'ram', 'ssd', 'cpu', 'gpu', ...colorTerms.flatMap((term) => term.split(' ')),
  ]);
  const tokens = text
    .replace(/\b\d+(?:gb|tb|mm|inch)\b/g, ' ')
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .split(' ')
    .filter((token) => token && !removableTerms.has(token) && !/^\d[\d.,]*$/.test(token));
  const compact = collapseRepeatedSequence(tokens).join(' ');
  return toProductTitleCase(compact);
}

function resolveRam(text: string, category: string) {
  const explicit = text.match(/\b(\d{1,3})gb\s*(?:ram|memory|memoria)\b|\b(\d{1,3})\s*ram\b/);
  const slash = text.match(/\b(\d{1,3})\s*\/\s*(\d{2,4})\b/);
  const memoryCandidates = Array.from(text.matchAll(/\b(\d{1,3})gb\b/g), (match) => Number(match[1]));
  const inferred = category === 'MacBook'
    ? memoryCandidates.find((value) => value <= 64)
    : undefined;
  const value = explicit?.[1] ?? explicit?.[2] ?? slash?.[1] ?? inferred;
  return value ? `${Number(value)}GB` : null;
}

function resolveStorage(text: string, ram: string | null) {
  const slash = text.match(/\b\d{1,3}\s*\/\s*(\d{2,4})\b/);
  if (slash?.[1]) return `${Number(slash[1])}GB`;

  const terabytes = text.match(/\b([1248])tb\b/);
  if (terabytes?.[1]) return `${terabytes[1]}TB`;

  const candidates = Array.from(text.matchAll(/\b(\d{2,4})gb\b/g), (match) => Number(match[1]));
  const ramValue = ram ? Number(ram.replace('GB', '')) : null;
  const storage = candidates.find((value) => value !== ramValue || candidates.length === 1 && value >= 64);
  return storage ? `${storage}GB` : null;
}

function resolveScreen(text: string, category: string) {
  if (category === 'Apple Watch') {
    const size = text.match(/\b(3[89]|4[02469])mm\b/)?.[1];
    return size ? `${size}mm` : null;
  }
  const explicit = text.match(/\b(1[0-6](?:\.\d+)?)inch\b|\b(1[0-6](?:\.\d+)?)\s*["”]/)?.[1]
    ?? text.match(/\b(1[0-6](?:\.\d+)?)inch\b|\b(1[0-6](?:\.\d+)?)\s*["”]/)?.[2];
  if (explicit) return `${explicit.replace(/\.\d$/, '')}"`;
  if (category === 'MacBook' || /\bipad\s+(?:air|pro|mini)\b/.test(text)) {
    const contextual = text.match(/\b(?:m\d+(?:\s+(?:pro|max))?|air|pro|neo)\s+(1[0-6](?:\.\d+)?)\b/)?.[1];
    if (contextual) return `${contextual.replace(/\.\d$/, '')}"`;
  }
  return null;
}

function resolveConnectivity(text: string) {
  if (/\bgps\s*(?:\+|e|and)?\s*cellular\b|\bgps\s*cell\b/.test(text)) return 'GPS + Cellular';
  if (/\bcellular\b|\bcom\s+cell\b/.test(text)) return 'Cellular';
  if (/\bgps\b/.test(text)) return 'GPS';
  if (/\be\s*sim\b|\besim\b/.test(text)) return 'eSIM';
  if (/\bwi\s*fi\b|\bwifi\b/.test(text)) return 'Wi-Fi';
  return null;
}

function resolveChip(text: string) {
  const chip = text.match(/\b([ma]\d+)\s*(pro|max)?\b/);
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

function toCanonicalKey(value: string) {
  return normalizeCanonicalText(value)
    .replace(/["”]/g, ' inch ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function collapseRepeatedSequence(tokens: string[]) {
  for (let size = Math.floor(tokens.length / 2); size > 0; size -= 1) {
    if (tokens.length !== size * 2) continue;
    if (tokens.slice(0, size).every((token, index) => token === tokens[index + size])) {
      return tokens.slice(0, size);
    }
  }
  return tokens.filter((token, index) => token !== tokens[index - 1]);
}

function joinLabel(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function toProductTitleCase(value: string) {
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
  if (/^[ma]\d+$/i.test(value)) return value.toUpperCase();
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1).toLowerCase()}` : '';
}

function containsTerm(text: string, term: string) {
  return new RegExp(`(?:^|\\s)${escapeRegExp(term)}(?:$|\\s)`).test(text);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
