import { describe, expect, it } from 'vitest';
import {
  containsNormalizedManufacturerAlias,
  isReservedAppleManufacturerAlias,
  normalizeManufacturerAlias,
} from './manufacturer-alias-normalizer';

describe('manufacturer alias normalization', () => {
  it('normalizes case, punctuation, diacritics and repeated spaces deterministically', () => {
    expect(normalizeManufacturerAlias('  BÓSE,   Corporation!  ')).toBe('bose corporation');
    expect(normalizeManufacturerAlias('BOSE Corporation')).toBe('bose corporation');
  });

  it('does not remove corporate suffixes automatically', () => {
    expect(normalizeManufacturerAlias('Bose Corporation')).toBe('bose corporation');
    expect(normalizeManufacturerAlias('Bose')).toBe('bose');
  });

  it('keeps Hewlett Packard distinct from HP unless both aliases are registered', () => {
    expect(normalizeManufacturerAlias('Hewlett Packard')).not.toBe(
      normalizeManufacturerAlias('HP'),
    );
  });

  it('matches aliases only on normalized token boundaries', () => {
    expect(
      containsNormalizedManufacturerAlias(
        normalizeManufacturerAlias('Garmin Vivoactive 6'),
        normalizeManufacturerAlias('Garmin'),
      ),
    ).toBe(true);
    expect(
      containsNormalizedManufacturerAlias(
        normalizeManufacturerAlias('Garminia Vivoactive 6'),
        normalizeManufacturerAlias('Garmin'),
      ),
    ).toBe(false);
  });

  it('reserves Apple and deterministically recognized Apple product identities', () => {
    expect(isReservedAppleManufacturerAlias('Apple')).toBe(true);
    expect(isReservedAppleManufacturerAlias('Apple Inc.')).toBe(true);
    expect(isReservedAppleManufacturerAlias('MacBook Air M5 13')).toBe(true);
    expect(isReservedAppleManufacturerAlias('Acme Electronics')).toBe(false);
  });
});
