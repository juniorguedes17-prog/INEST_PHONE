import { describe, expect, it, vi } from 'vitest';
import { backfillVariantAttributes } from './variant-attributes-backfill';
import {
  VariantAttributesValidationError,
  deriveVariantAttributes,
  materializeVariantAttributes,
  validateVariantAttributes,
} from './variant-attributes';
import { deriveExtendedProductIdentity } from '@inest/product-identity';

const novo = { quality: 'NOVO' };

describe('Product variant attributes', () => {
  it('derives only canonical MacBook Neo attributes without duplicating storage or condition', () => {
    const base256 = deriveVariantAttributes({
      ...novo,
      productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB',
    });
    const base512 = deriveVariantAttributes({
      ...novo,
      productDescription: 'MacBook Neo A18 Pro 13" 8GB/512GB',
    });

    expect(base256).toMatchObject({
      status: 'auto',
      family: 'macbook',
      attributes: { chip: 'A18 Pro', chipVariant: 'pro', screen: '13"', ram: '8GB' },
    });
    expect(base512).toMatchObject({
      status: 'auto',
      family: 'macbook',
      attributes: { chip: 'A18 Pro', chipVariant: 'pro', screen: '13"', ram: '8GB' },
    });
    expect(base256.attributes).not.toHaveProperty('storage');
    expect(base256.attributes).not.toHaveProperty('condition');
  });

  it('persists only attributes that the Core determines for supported families', () => {
    expect(deriveVariantAttributes({ ...novo, productDescription: 'iPad 11 A16 128GB Wi-Fi' }))
      .toMatchObject({
        status: 'auto',
        family: 'ipad',
        attributes: { chip: 'A16', screen: '11"', connectivity: 'Wi-Fi' },
      });
    expect(deriveVariantAttributes({ ...novo, productDescription: 'Apple Watch Series 11 42mm GPS' }))
      .toMatchObject({
        status: 'auto',
        family: 'apple-watch',
        attributes: { screen: '42mm', connectivity: 'GPS' },
      });
    expect(deriveVariantAttributes({ ...novo, productDescription: 'Apple Watch Series 11 46mm GPS' }))
      .toMatchObject({
        status: 'auto',
        family: 'apple-watch',
        attributes: { screen: '46mm', connectivity: 'GPS' },
      });
    expect(deriveVariantAttributes({
      ...novo,
      category: 'Acessorios',
      productDescription: 'Carregador Apple 20W USB-C',
    }))
      .toMatchObject({
        status: 'auto',
        family: 'accessory',
        attributes: { connector: 'usb-c', power: '20w' },
      });
  });

  it('materializes canonical dimensions when the Core exposes them in its attribute map', () => {
    const macbook = deriveExtendedProductIdentity({
      ...novo,
      productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB',
    }).variant;
    const ipad = deriveExtendedProductIdentity({
      ...novo,
      productDescription: 'iPad 11 A16 128GB Wi-Fi',
    }).variant;
    const watch = deriveExtendedProductIdentity({
      ...novo,
      productDescription: 'Apple Watch Series 11 42mm GPS',
    }).variant;

    expect(materializeVariantAttributes({ ...macbook, canonicalChip: null, canonicalScreen: null, canonicalRam: null }))
      .toMatchObject({ chip: 'a18-pro', chipVariant: 'pro', screen: '13"', ram: '8gb' });
    expect(materializeVariantAttributes({ ...ipad, canonicalChip: null, canonicalScreen: null, canonicalConnectivity: null }))
      .toMatchObject({ chip: 'a16', screen: '11"', connectivity: 'wi-fi' });
    expect(materializeVariantAttributes({ ...watch, canonicalScreen: null, canonicalConnectivity: null }))
      .toMatchObject({ screen: '42mm', connectivity: 'gps' });
  });

  it('keeps optional iPhone attributes absent when the Core cannot prove them', () => {
    expect(deriveVariantAttributes({ ...novo, productDescription: 'iPhone 17 Air 256GB' }))
      .toMatchObject({ status: 'auto', family: 'iphone', attributes: {} });
  });

  it('rejects JSON keys outside the family contract', () => {
    expect(() => validateVariantAttributes({ storage: '256GB' }, 'macbook'))
      .toThrow(VariantAttributesValidationError);
    expect(() => validateVariantAttributes({ chip: '' }, 'macbook'))
      .toThrow(VariantAttributesValidationError);
  });

  it('does not write during dry-run and blocks collisions without stopping other classifications', async () => {
    const updateVariantAttributes = vi.fn();
    const result = await backfillVariantAttributes([
      { id: 'neo-1', variantAttributes: null, ...novo, productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB' },
      { id: 'neo-2', variantAttributes: null, ...novo, productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB' },
      { id: 'unknown', variantAttributes: null, ...novo, productDescription: 'Produto desconhecido 256GB' },
    ], { updateVariantAttributes }, true);

    expect(updateVariantAttributes).not.toHaveBeenCalled();
    expect(result.collisions).toHaveLength(1);
    expect(result.blocked).toEqual(expect.arrayContaining([
      { id: 'neo-1', reason: 'colisao_canonical_variant' },
      { id: 'neo-2', reason: 'colisao_canonical_variant' },
    ]));
    expect(result.review).toEqual([{ id: 'unknown', reason: 'identidade_insuficiente' }]);
  });

  it('preserves Product identity and operational fields by updating only absent attributes once', async () => {
    const product: {
      id: string;
      variantAttributes: unknown;
      active: boolean;
      status: string;
      deletedAt: Date | null;
      quality: string;
      productDescription: string;
    } = {
      id: 'neo-256',
      variantAttributes: null,
      active: true,
      status: 'ACTIVE',
      deletedAt: null,
      ...novo,
      productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB',
    };
    const updateVariantAttributes = vi.fn(async (_id: string, attributes: unknown) => {
      product.variantAttributes = attributes;
    });
    const store = { updateVariantAttributes };

    const first = await backfillVariantAttributes([product], store, false);
    const second = await backfillVariantAttributes([product], store, false);

    expect(first.updates).toBe(1);
    expect(second.updates).toBe(0);
    expect(second.unchanged).toBe(1);
    expect(updateVariantAttributes).toHaveBeenCalledTimes(1);
    expect(product).toMatchObject({ id: 'neo-256', active: true, status: 'ACTIVE', deletedAt: null });
  });
});
