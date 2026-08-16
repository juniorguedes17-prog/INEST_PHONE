import { describe, expect, it } from 'vitest';
import { parseBrazilianDecimal } from './product.dto';

describe('parseBrazilianDecimal', () => {
  it.each([
    ['590', 590],
    ['590,00', 590],
    ['1.090', 1090],
    ['1.090,00', 1090],
    ['R$ 1.090,00', 1090],
  ])('converts the Brazilian monetary input %s to %d', (input, expected) => {
    expect(parseBrazilianDecimal(input)).toBe(expected);
  });
});
