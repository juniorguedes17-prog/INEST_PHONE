import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMERCIAL_PRICE_ENDINGS,
  normalizeCommercialPriceEndings,
  roundUpToCommercialPrice,
} from './commercial-price-rounding';

describe('roundUpToCommercialPrice', () => {
  it.each([
    [4312, 4349],
    [4349, 4349],
    [4350, 4370],
    [4351, 4370],
    [4355, 4370],
    [4370, 4370],
    [4375, 4449],
    [4399, 4449],
    [4400, 4449],
    [4312.01, 4349],
    [4348.01, 4349],
    [4349.01, 4370],
    [4369.01, 4370],
    [4370.01, 4449],
  ])('rounds %s up to %s with 49/70 endings', (basePrice, expected) => {
    expect(roundUpToCommercialPrice(basePrice, [49, 70])).toBe(expected);
  });

  it('sorts endings before selecting the next commercial price', () => {
    expect(roundUpToCommercialPrice(4355, [70, 49])).toBe(4370);
  });

  it('uses configured endings', () => {
    expect(roundUpToCommercialPrice(4355, [49, 90])).toBe(4390);
  });

  it('falls back to the safe defaults for missing or invalid endings', () => {
    expect(normalizeCommercialPriceEndings()).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
    expect(normalizeCommercialPriceEndings(['', 70])).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
    expect(normalizeCommercialPriceEndings([49, 49])).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
    expect(normalizeCommercialPriceEndings([-1, 70])).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
    expect(normalizeCommercialPriceEndings([49.5, 70])).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
    expect(normalizeCommercialPriceEndings([49, 100])).toEqual(DEFAULT_COMMERCIAL_PRICE_ENDINGS);
  });
});
