export interface SourceDisplayNameInput {
  sourceName: string;
  sourceManufacturer?: string | null;
  model?: string | null;
  capacity?: string | null;
}

/** Presentation-only formatter. Financial identity remains independent. */
export function formatSourceDisplayName(input: SourceDisplayNameInput) {
  const sourceName = input.sourceName.trim().replace(/\s+/g, ' ');
  const macBook = formatMacBook(sourceName);
  if (macBook) return macBook;

  const camera = formatCamera(sourceName, input.sourceManufacturer);
  if (camera) return camera;

  return sourceName;
}

function formatMacBook(name: string) {
  const family = name.match(/\bMacBook\s+(Air|Pro|Neo)\b/i)?.[1];
  const screen = name.match(
    /\b(13|14|15|16)(?:\.\d+)?\s*(?:["\u201c\u201d\u2033]|pol(?:egadas?)?)?\b/i,
  )?.[1];
  const chip = name.match(/\b(?:M\d+|A\d+)(?:\s+(?:Pro|Max|Ultra))?\b/i)?.[0];
  const values = Array.from(name.matchAll(/\b(\d+(?:\.\d+)?)\s*(GB|TB)\b/gi))
    .map((match) => `${match[1]}${match[2]?.toUpperCase()}`)
    .filter(Boolean);
  if (!family || !screen || !chip || values.length < 2) return null;
  return `MacBook ${capitalize(family)} ${screen}\u201d Chip ${chip.replace(/\s+/g, ' ')} ${values.slice(0, 2).join('/')}`;
}

function formatCamera(name: string, manufacturer?: string | null) {
  if (!manufacturer || !/\bCanon\b/i.test(manufacturer)) return null;
  const model = name.match(/\bEOS\s+Rebel\s+T7\b/i)?.[0];
  const megapixels = name.match(/\b\d+(?:\.\d+)?\s*MP\b/i)?.[0];
  const lens = name.match(/\b(?:EF-S\s+)?18\s*-?\s*55\s*MM\b/i)?.[0];
  if (!model || !megapixels || !lens) return null;
  return `Canon ${model} ${megapixels.replace(/\s+/g, '')} + Lente ${lens
    .replace(/\s*MM/i, 'mm')
    .replace(/\s+/g, ' ')}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
