export const DEFAULT_COMMERCIAL_PRICE_ENDINGS = [49, 70] as const;
export const PRICING_CONFIGURATION_SCOPE = 'pricing';
export const COMMERCIAL_ROUNDING_ENDING_ONE_KEY = 'commercial_rounding_ending_1';
export const COMMERCIAL_ROUNDING_ENDING_TWO_KEY = 'commercial_rounding_ending_2';

export function hasValidCommercialPriceEndings(endings: readonly unknown[]): boolean {
  if (endings.length !== 2) return false;

  const parsed = endings.map(parseCommercialEnding);
  if (parsed.some((ending) => ending === null)) return false;

  const firstEnding = parsed[0]!;
  const secondEnding = parsed[1]!;
  return (
    firstEnding !== secondEnding &&
    Number.isInteger(firstEnding) &&
    Number.isInteger(secondEnding) &&
    firstEnding >= 0 &&
    firstEnding <= 99 &&
    secondEnding >= 0 &&
    secondEnding <= 99
  );
}

export function normalizeCommercialPriceEndings(endings?: readonly unknown[]): number[] {
  if (!endings || !hasValidCommercialPriceEndings(endings)) {
    return [...DEFAULT_COMMERCIAL_PRICE_ENDINGS];
  }

  return endings.map(Number).sort((left, right) => left - right);
}

export function roundUpToCommercialPrice(
  basePrice: number,
  commercialEndings?: readonly unknown[],
): number {
  if (!Number.isFinite(basePrice)) {
    throw new Error('Preco base invalido para arredondamento comercial.');
  }

  const integerBase = Math.ceil(basePrice);
  const endings = normalizeCommercialPriceEndings(commercialEndings);
  const hundred = Math.floor(integerBase / 100) * 100;
  const currentHundredCandidate = endings
    .map((ending) => hundred + ending)
    .find((candidate) => candidate >= integerBase);

  return currentHundredCandidate ?? hundred + 100 + endings[0]!;
}

function parseCommercialEnding(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
