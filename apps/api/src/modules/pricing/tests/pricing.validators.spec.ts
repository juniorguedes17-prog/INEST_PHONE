import { describe, expect, it } from 'vitest';
import { quoteIsValid, toNumber } from '../validators/pricing.validators';

describe('pricing validators', () => {
  it('rejects quotes with BRD exclusion terms', () => {
    expect(quoteIsValid({ notes: 'Tela nao genuina', quality: 'Grade A+' })).toBe(false);
    expect(quoteIsValid({ notes: 'Face ID com problema', quality: 'Grade A+' })).toBe(false);
    expect(quoteIsValid({ notes: 'Produto aprovado', quality: 'Grade B' })).toBe(false);
  });

  it('rejects inactive or rejected product and supplier records', () => {
    expect(quoteIsValid({ productStatus: 'INACTIVE' })).toBe(false);
    expect(quoteIsValid({ productStatus: 'REJECTED' })).toBe(false);
    expect(quoteIsValid({ supplierStatus: 'INACTIVE' })).toBe(false);
  });

  it('accepts valid approved quotes and normalizes numeric values', () => {
    expect(
      quoteIsValid({
        notes: 'Sem alertas internos',
        quality: 'Grade A+',
        productStatus: 'ACTIVE',
        supplierStatus: 'ACTIVE',
      }),
    ).toBe(true);
    expect(toNumber('1250.5')).toBe(1250.5);
    expect(toNumber(undefined)).toBe(0);
  });
});
