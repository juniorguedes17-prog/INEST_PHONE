export const OFFER_INCREMENT_KEY = 'offer_increment';
export const DEFAULT_OFFER_INCREMENT = 100;

export function hasValidOfferIncrement(value: unknown): boolean {
  const increment = toOfferIncrementNumber(value);
  return increment !== null && Math.round(increment * 100) === increment * 100;
}

export function normalizeOfferIncrement(value: unknown): number {
  return hasValidOfferIncrement(value) ? Number(value) : DEFAULT_OFFER_INCREMENT;
}

function toOfferIncrementNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const increment = Number(value);
  return Number.isFinite(increment) && increment >= 0 ? increment : null;
}
