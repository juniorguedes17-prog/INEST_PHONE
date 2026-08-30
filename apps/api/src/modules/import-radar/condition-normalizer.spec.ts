import { describe, expect, it } from 'vitest';
import { normalizeProductCondition } from './condition-normalizer';

describe('normalizeProductCondition', () => {
  it.each([
    ['NEW', 'NOVO'],
    ['NOVO', 'NOVO'],
    ['LACRADO', 'NOVO'],
    ['USED', 'SEMINOVO'],
    ['PRE-OWNED', 'SEMINOVO'],
    ['REFURBISHED', 'SEMINOVO'],
    ['RECONDITIONED', 'SEMINOVO'],
    ['RENEWED', 'SEMINOVO'],
    ['OPEN BOX', 'SEMINOVO'],
    ['SEMINOVO', 'SEMINOVO'],
    ['CPO', 'CPO'],
    ['APPLE CPO', 'CPO'],
    ['APPLE CERTIFIED PRE-OWNED', 'CPO'],
    ['APPLE CERTIFIED REFURBISHED', 'CPO'],
  ])('%s -> %s', (source, condition) => {
    expect(normalizeProductCondition(source)).toEqual({ status: 'RESOLVED', condition });
  });

  it.each(['UNKNOWN', 'CERTIFIED CONDITION', 'RECONDITIONED NEW'])(
    '%s remains unresolved',
    (source) => {
      expect(normalizeProductCondition(source)).toMatchObject({
        status: 'UNRESOLVED',
        condition: null,
      });
    },
  );

  it('gives explicit Apple certification precedence over generic refurbished', () => {
    expect(normalizeProductCondition('Apple Certified Refurbished')).toEqual({
      status: 'RESOLVED',
      condition: 'CPO',
    });
  });
});
