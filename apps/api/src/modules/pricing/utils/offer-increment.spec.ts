import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OFFER_INCREMENT,
  hasValidOfferIncrement,
  normalizeOfferIncrement,
} from './offer-increment';

describe('offer increment configuration', () => {
  it('uses R$100 when the configuration is absent or invalid', () => {
    expect(normalizeOfferIncrement(undefined)).toBe(DEFAULT_OFFER_INCREMENT);
    expect(normalizeOfferIncrement('invalid')).toBe(DEFAULT_OFFER_INCREMENT);
    expect(normalizeOfferIncrement(-1)).toBe(DEFAULT_OFFER_INCREMENT);
    expect(normalizeOfferIncrement(100.555)).toBe(DEFAULT_OFFER_INCREMENT);
  });

  it('accepts zero and currency values with up to two decimal places', () => {
    expect(normalizeOfferIncrement(0)).toBe(0);
    expect(normalizeOfferIncrement('50')).toBe(50);
    expect(normalizeOfferIncrement('100.50')).toBe(100.5);
    expect(normalizeOfferIncrement(150.75)).toBe(150.75);
  });

  it('rejects negative, non-finite and over-precise values', () => {
    expect(hasValidOfferIncrement(-0.01)).toBe(false);
    expect(hasValidOfferIncrement(Number.NaN)).toBe(false);
    expect(hasValidOfferIncrement(Number.POSITIVE_INFINITY)).toBe(false);
    expect(hasValidOfferIncrement(100.001)).toBe(false);
  });
});
