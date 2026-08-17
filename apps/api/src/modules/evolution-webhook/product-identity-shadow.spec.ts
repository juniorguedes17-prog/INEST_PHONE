import { describe, expect, it } from 'vitest';
import { parseSupplierListText } from './supplier-list.parser';
import { processParsedSupplierItemsShadow } from './product-identity-shadow';

describe('product identity ingestion shadow', () => {
  it('observa iPad sem alterar o item do parser', () => {
    const [item] = parseSupplierListText('iPad 11 128GB Wi-Fi\nPink R$ 2.550');
    const before = structuredClone(item);
    const [observation] = processParsedSupplierItemsShadow([item!]);

    expect(item).toEqual(before);
    expect(observation?.identity.canonical.canonicalModelKey).toBe('ipad-11');
    expect(observation?.identity.canonical.canonicalScreen).toBe('11"');
    expect(observation?.identity.canonical.canonicalScreenSource).toBe('model_invariant');
    expect(observation?.identity.profit.status).toBe('valid');
  });

  it('observa Apple Watch GPS sem substituir conectividade ou preco', () => {
    const [item] = parseSupplierListText('Apple Watch SE 3 GPS 40mm S/M\nMidnight R$ 1.470');
    const before = structuredClone(item);
    const [observation] = processParsedSupplierItemsShadow([item!]);

    expect(item).toEqual(before);
    expect(observation?.identity.canonical.canonicalModelKey).toBe('apple-watch-se-3-40');
    expect(observation?.identity.canonical.canonicalConnectivity).toBe('GPS');
    expect(observation?.identity.canonical.canonicalConnectivitySource).toBe('explicit');
  });

  it('preserva preco e rawLine em blocos independentes Tala Cell', () => {
    const items = parseSupplierListText(`
      IPHONE 17 256GB AS IS
      PRETO R$ 4.389
      IPHONE 16 128GB
      PRETO R$ 3.350
    `);
    const before = structuredClone(items);
    const observations = processParsedSupplierItemsShadow(items);

    expect(items).toEqual(before);
    expect(observations.map(({ item }) => [item.normalizedName, item.price, item.rawLine])).toEqual([
      ['iphone 17 256gb as is', 4389, 'PRETO R$ 4.389'],
      ['iphone 16 128gb', 3350, 'PRETO R$ 3.350'],
    ]);
  });

  it('preserva cotacoes independentes de Mac e acessorio', () => {
    const items = parseSupplierListText(`
      Mac Mini M4 16/512
      R$ 5.700
      Cabo USB-C / Lightning Original
      R$ 70
    `);
    const before = structuredClone(items);
    const observations = processParsedSupplierItemsShadow(items);

    expect(items).toEqual(before);
    expect(observations.map(({ item }) => [item.normalizedName, item.price])).toEqual([
      ['mac mini m4 16 512', 5700],
      ['cabo usb c lightning', 70],
    ]);
  });
});
