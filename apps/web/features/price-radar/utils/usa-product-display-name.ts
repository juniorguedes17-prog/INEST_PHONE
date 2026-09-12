export type UsaProductDisplayNameInput = {
  sourceName: string;
  displayName?: string | null;
  commercialName?: string | null;
  sourceManufacturer?: string | null;
  category?: string | null;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  condition?: string | null;
};

export function resolveUsaProductDisplayName(input: UsaProductDisplayNameInput): string {
  const commercialName = compact(input.commercialName);
  if (commercialName) return commercialName;

  const structuredName = buildStructuredPresentationName(input);
  if (structuredName) return structuredName;

  return compact(input.displayName) ?? compact(input.sourceName) ?? input.sourceName;
}

function buildStructuredPresentationName(input: UsaProductDisplayNameInput): string | null {
  const manufacturer = compact(input.sourceManufacturer);
  const model = compact(input.model);
  const values = model
    ? [manufacturer, model, input.capacity, input.color, input.condition]
    : [manufacturer, input.category, input.capacity, input.color, input.condition];
  const uniqueValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const compactValue = compact(value);
    if (!compactValue) continue;
    const comparisonKey = mechanicalComparisonKey(compactValue);
    if (!comparisonKey || seen.has(comparisonKey)) continue;
    seen.add(comparisonKey);
    uniqueValues.push(compactValue);
  }

  if (model) return uniqueValues.join(' ') || null;
  if (manufacturer && uniqueValues.length >= 2) return uniqueValues.join(' ');
  return null;
}

function compact(value: string | null | undefined): string | null {
  const compactValue = value?.replace(/\s+/g, ' ').trim() ?? '';
  return compactValue || null;
}

function mechanicalComparisonKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[®™]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
