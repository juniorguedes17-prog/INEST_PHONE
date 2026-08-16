export interface ProductCardPresentationInput {
  canonicalDescription?: string | null;
  rawDescription?: string | null;
  category?: string | null;
  condition?: string | null;
  capacity?: string | null;
  color?: string | null;
}

export interface ProductCardPresentation {
  title: string;
  attributes: string[];
}

const conditionLabels = new Set(['NOVO', 'SEMINOVO', 'CPO']);

export function getProductCardPresentation(input: ProductCardPresentationInput): ProductCardPresentation {
  const title = cleanProductCardText(
    input.canonicalDescription || input.rawDescription || input.category || 'Produto',
  );
  const source = `${input.canonicalDescription || ''} ${input.rawDescription || ''}`;
  const attributes = [
    getCondition(input.condition),
    getRam(source),
    getStorage(input.capacity, source),
    cleanAttribute(input.color),
  ].filter((value): value is string => Boolean(value));

  return { title, attributes: Array.from(new Set(attributes.map((value) => value.trim()))) };
}

export function cleanProductCardText(value: string): string {
  const cleaned = value
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, ' ')
    .replace(/[*_~\u2022]+/g, ' ')
    .replace(/[,:;]+(?=\s|$)/g, ' ')
    .replace(/\s+(GB|TB|MM)\b/gi, '$1')
    .replace(/\bUSB\s*C\b/gi, 'USB-C')
    .replace(/\bWI\s*FI\b/gi, 'Wi-Fi')
    .replace(/\s+/g, ' ')
    .trim();

  return formatProductTitle(cleaned);
}

function getCondition(value?: string | null): string | undefined {
  const normalized = value?.trim().toUpperCase();
  return normalized && conditionLabels.has(normalized) ? normalized : undefined;
}

function getRam(source: string): string | undefined {
  const explicit = source.match(/\b(\d{1,2})\s*(?:GB\s*)?(?:RAM|MEMORIA|MEMORY)\b/i);
  if (explicit?.[1]) return `${explicit[1]}GB RAM`;

  if (/\b(?:MACBOOK|MAC\s+(?:AIR|PRO|NEO|MINI))\b/i.test(source)) {
    const compact = source.match(/\b(\d{1,2})\s*(?:GB)?\s*\/\s*\d+\s*(?:GB|TB)\b/i);
    if (compact?.[1]) return `${compact[1]}GB RAM`;
  }

  return undefined;
}

function getStorage(capacity: string | null | undefined, source: string): string | undefined {
  const fromCapacity = normalizeStorage(capacity);
  if (fromCapacity) return fromCapacity;

  if (/\b(?:MACBOOK|MAC\s+(?:AIR|PRO|NEO|MINI))\b/i.test(source)) {
    const compact = source.match(/\b\d{1,2}\s*(?:GB)?\s*\/\s*(\d+)\s*(GB|TB)\b/i);
    if (compact?.[1] && compact[2]) return `${compact[1]}${compact[2].toUpperCase()}`;
  }

  const values = Array.from(source.matchAll(/\b(\d+)\s*(GB|TB)\b/gi));
  const last = values.at(-1);
  return last?.[1] && last[2] ? `${last[1]}${last[2].toUpperCase()}` : undefined;
}

function normalizeStorage(value?: string | null): string | undefined {
  const match = value?.match(/\b(\d+)\s*(GB|TB)\b/i);
  return match?.[1] && match[2] ? `${match[1]}${match[2].toUpperCase()}` : undefined;
}

function cleanAttribute(value?: string | null): string | undefined {
  const cleaned = value ? cleanProductCardText(value) : '';
  return cleaned || undefined;
}

function formatProductTitle(value: string): string {
  if (!value) return 'Produto';

  const title = value
    .toLocaleLowerCase('pt-BR')
    .replace(/\b[\p{L}\p{N}]+\b/gu, (word) => `${word.charAt(0).toLocaleUpperCase('pt-BR')}${word.slice(1)}`);

  return title
    .replace(/\bIphone\b/g, 'iPhone')
    .replace(/\bIpad\b/g, 'iPad')
    .replace(/\bMacbook\b/g, 'MacBook')
    .replace(/\bAirpods\b/g, 'AirPods')
    .replace(/\bEarpods\b/g, 'EarPods')
    .replace(/\bApplewatch\b/g, 'Apple Watch')
    .replace(/\bSe(\d+)\b/g, 'SE$1')
    .replace(/\bUsbc\b/g, 'USB-C')
    .replace(/\bEsim\b/g, 'eSIM')
    .replace(/\bWifi\b/g, 'Wi-Fi')
    .replace(/\bGps\b/g, 'GPS')
    .replace(/\bRam\b/g, 'RAM')
    .replace(/\bCpu\b/g, 'CPU')
    .replace(/\bGpu\b/g, 'GPU')
    .replace(/\b(\d+)Gb\b/g, '$1GB')
    .replace(/\b(\d+)Tb\b/g, '$1TB')
    .replace(/\b(\d+)Mm\b/g, '$1mm');
}
