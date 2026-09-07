export function formatQuoteInput(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',');
}

/** Returns NaN for non-numeric input; range rules remain field-specific. */
export function parseQuoteInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const separators = trimmed.match(/[,.]/g) ?? [];
  if (separators.length > 1) {
    return Number.NaN;
  }

  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
