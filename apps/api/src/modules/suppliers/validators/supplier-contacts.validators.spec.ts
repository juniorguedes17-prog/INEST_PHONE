import { describe, expect, it } from 'vitest';
import { normalizeWhatsappNumber } from './supplier-contacts.validators';

describe('normalizeWhatsappNumber', () => {
  it('keeps only E.164 digits', () => {
    expect(normalizeWhatsappNumber('+55 (11) 94302-0886')).toBe('5511943020886');
    expect(normalizeWhatsappNumber('+595 973 648393V')).toBe('595973648393');
  });

  it('rejects an empty or invalid number', () => {
    expect(() => normalizeWhatsappNumber('sem telefone')).toThrow(
      'Numero de WhatsApp invalido para o padrao E.164.',
    );
  });
});
