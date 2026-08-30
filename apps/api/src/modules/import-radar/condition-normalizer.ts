export const IMPORT_PRODUCT_CONDITIONS = ['NOVO', 'SEMINOVO', 'CPO'] as const;

export type ImportProductCondition = (typeof IMPORT_PRODUCT_CONDITIONS)[number];

export type ProductConditionResolution =
  | { status: 'RESOLVED'; condition: ImportProductCondition }
  | { status: 'UNRESOLVED'; condition: null; reason: 'unknown' | 'conflicting' };

const CONDITION_MARKERS = {
  cpo: /\bcpo\b|\bapple\s+(?:cpo|certified\s+(?:pre[- ]?owned|refurbished))\b/,
  novo: /\b(?:new|novo|lacrado|lacrados|lacrada|lacradas)\b/,
  seminovo:
    /\b(?:used|pre[- ]?owned|preowned|refurbished|reconditioned|renewed|open\s+box|seminovo|semi\s+novo)\b/,
} as const;

function normalizeConditionText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProductCondition(
  value: string | null | undefined,
): ProductConditionResolution {
  const text = normalizeConditionText(value ?? '');
  if (!text) return { status: 'UNRESOLVED', condition: null, reason: 'unknown' };

  // Explicit Apple certification/CPO has authority over the generic refurbished marker.
  if (CONDITION_MARKERS.cpo.test(text)) {
    return { status: 'RESOLVED', condition: 'CPO' };
  }

  const hasNovo = CONDITION_MARKERS.novo.test(text);
  const hasSeminovo = CONDITION_MARKERS.seminovo.test(text);
  if (hasNovo && hasSeminovo) {
    return { status: 'UNRESOLVED', condition: null, reason: 'conflicting' };
  }
  if (hasSeminovo) return { status: 'RESOLVED', condition: 'SEMINOVO' };
  if (hasNovo) return { status: 'RESOLVED', condition: 'NOVO' };
  return { status: 'UNRESOLVED', condition: null, reason: 'unknown' };
}
