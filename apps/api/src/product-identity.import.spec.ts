import { normalizeCanonicalProductIdentity } from '@inest/product-identity';
import { describe, expect, it } from 'vitest';

describe('Product Identity Core compartilhado', () => {
  it('pode ser importado pela API sem ativar consumidor funcional', () => {
    const identity = normalizeCanonicalProductIdentity('iPhone 17 Pro Max 256GB');

    expect(identity.canonicalModelKey).toBe('iphone-17-pro-max');
    expect(identity.canonicalStorage).toBe('256GB');
  });
});
