export const PRODUCT_CONDITIONS = ['NOVO', 'SEMINOVO', 'CPO'] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export type ProductConditionResolution =
  | { status: 'RESOLVED'; condition: ProductCondition }
  | { status: 'UNRESOLVED'; condition: null; reason: 'unknown' | 'conflicting' };

const CONDITION_MARKERS = {
  cpo: /\bcpo\b|\bapple\s+(?:cpo|certified\s+(?:pre[- ]?owned|refurbished))\b/,
  // `semi novo(s)` is a single SEMINOVO marker, not simultaneous evidence
  // for NOVO. The negative lookbehind keeps that vocabulary unambiguous.
  novo: /\b(?:new|(?<!semi\s)novo|(?<!semi\s)novos|lacrad[oa]s?|sealed)\b/,
  seminovo:
    /\b(?:used|pre[- ]?owned|preowned|refurbished|reconditioned|renewed|open\s+box|seminovos?|semi\s+novos?|usad[oa]s?|vitrine|swap|as[- ]?is|no\s?active|not\s?active|never\s?activ(?:e|ated)|nunca\s?(?:active|ativado)|nao\s?ativado|recondicionad[oa]s?)\b/,
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

  // Explicit CPO / Apple Certified evidence has authority over generic used markers.
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
