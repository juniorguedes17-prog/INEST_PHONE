import { describe, expect, it } from 'vitest';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { parseSupplierListText } from './supplier-list.parser';
import {
  processParsedSupplierItemsShadow,
  resolveProductIdShadow,
  type ProductIdShadowCandidate,
} from './product-identity-shadow';

function catalogProduct(
  id: string,
  productDescription: string,
  profitCondition = 'NOVO',
  variantAttributes: unknown = null,
): ProductIdShadowCandidate {
  const storageMatch = [...productDescription.matchAll(/\b(\d+)\s*(GB|TB)\b/gi)].at(-1);
  const storage = storageMatch?.[1] ?? null;
  const storageUnit = storageMatch?.[2]?.toUpperCase() ?? null;
  return {
    id,
    productDescription,
    productType: productDescription.toLowerCase().includes('ipad')
      ? 'IPAD'
      : productDescription.toLowerCase().includes('watch')
        ? 'APPLE_WATCH'
        : productDescription.toLowerCase().includes('mac')
          ? 'MACBOOK'
          : profitCondition === 'CPO'
            ? 'APPLE_CPO'
            : 'IPHONE_SEALED',
    profitCondition,
    variantAttributes,
    category: null,
    model: null,
    color: null,
    storage: storage
      ? { displayName: `${storage} ${storageUnit}`, value: storage, unit: storageUnit }
      : null,
  };
}

function airpodsCatalogProduct(id: string, productDescription: string, profitCondition = 'NOVO') {
  return {
    ...catalogProduct(id, productDescription, profitCondition),
    productType: 'AIRPODS',
    category: { name: 'AirPods' },
    model: { name: productDescription },
  };
}

function supplierIdentity(productName: string, condition = 'NOVO') {
  return deriveExtendedProductIdentity({ productName, quality: condition });
}

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
    expect(observations.map(({ item }) => [item.normalizedName, item.price, item.rawLine])).toEqual(
      [
        ['iphone 17 256gb as is', 4389, 'PRETO R$ 4.389'],
        ['iphone 16 128gb', 3350, 'PRETO R$ 3.350'],
      ],
    );
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

  it('resolves exactly one structured catalog candidate for MacBook Neo text variations', () => {
    const catalog = [
      catalogProduct('neo-256', 'MacBook Neo A18 Pro 13" 8GB/256GB', 'NOVO', {
        chip: 'A18 Pro',
        chipVariant: 'pro',
        screen: '13"',
        ram: '8GB',
      }),
    ];

    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo A18 Pro 13" 8GB 256GB'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-256', candidateCount: 1 });
    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo 8/256GB 13"'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-256', candidateCount: 1 });
    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo A18 Pro 8GB / 256GB 13”'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-256', candidateCount: 1 });
    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo 13 8GB/256GB'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-256', candidateCount: 1 });
  });

  it('resolves Neo when the master description omits chip text but the model invariant supplies it', () => {
    const catalog = [catalogProduct('neo-256', 'MacBook Neo 13 8/256GB')];

    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo (A18) Pro 13" 8/256GB'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-256', candidateCount: 1 });
  });

  it('resolves abbreviated MacBook memory against the complete master description', () => {
    const catalog = [catalogProduct('neo-512', 'MacBook Neo A18 Pro 13" 8GB/512GB')];

    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Neo 13" 8G 512'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'neo-512', candidateCount: 1 });
  });

  it('keeps Apple Watch size and connectivity variants distinct', () => {
    const catalog = [
      catalogProduct('watch-42-gps', 'Apple Watch Series 11 42mm GPS'),
      catalogProduct('watch-46-gps', 'Apple Watch Series 11 46mm GPS'),
      catalogProduct('watch-42-cellular', 'Apple Watch Series 11 42mm GPS + Cellular'),
    ];

    expect(
      resolveProductIdShadow(supplierIdentity('Apple Watch Series 11 42mm GPS'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'watch-42-gps' });
    expect(
      resolveProductIdShadow(supplierIdentity('Apple Watch Series 11 46mm GPS'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'watch-46-gps' });
    expect(
      resolveProductIdShadow(
        supplierIdentity('Apple Watch Series 11 42mm GPS + Cellular'),
        catalog,
      ),
    ).toMatchObject({ status: 'FOUND', productId: 'watch-42-cellular' });
  });

  it('resolves Apple Watch without connectivity to the GPS catalog variant', () => {
    const catalog = [
      catalogProduct('watch-se-3-44-gps', 'Apple Watch SE 3 44mm GPS'),
      catalogProduct('watch-se-3-44-cellular', 'Apple Watch SE 3 44mm GPS + Cellular'),
    ];

    expect(
      resolveProductIdShadow(supplierIdentity('Apple Watch SE 3 44mm'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'watch-se-3-44-gps', candidateCount: 1 });
  });

  it('keeps storage and condition variants distinct and fails closed for missing or ambiguous candidates', () => {
    const catalog = [
      catalogProduct('air-256-new', 'iPhone 17 Air 256GB'),
      catalogProduct('air-512-new', 'iPhone 17 Air 512GB'),
      catalogProduct('air-256-cpo', 'iPhone 17 Air 256GB', 'CPO'),
    ];

    expect(resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB'), catalog)).toMatchObject({
      status: 'FOUND',
      productId: 'air-256-new',
    });
    expect(resolveProductIdShadow(supplierIdentity('iPhone 17 Air 512GB'), catalog)).toMatchObject({
      status: 'FOUND',
      productId: 'air-512-new',
    });
    expect(
      resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB', 'CPO'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'air-256-cpo' });
    expect(resolveProductIdShadow(supplierIdentity('iPhone 17 Air 1TB'), catalog)).toMatchObject({
      status: 'MISSING',
      reason: 'catalog_no_match',
    });
    expect(
      resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB'), [
        catalog[0]!,
        catalogProduct('air-256-new-duplicate', 'iPhone 17 Air 256GB'),
      ]),
    ).toMatchObject({
      status: 'AMBIGUOUS',
      candidates: ['air-256-new', 'air-256-new-duplicate'],
      candidateCount: 2,
    });
  });

  it('keeps the VM2 decision while exposing deterministic resolution reasons', () => {
    expect(resolveProductIdShadow(supplierIdentity('MacBook Neo 8/512GB'), [])).toMatchObject({
      status: 'MISSING',
      reason: 'identity_insufficient',
      candidateCount: 0,
    });
    expect(resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB'), [])).toMatchObject({
      status: 'MISSING',
      reason: 'catalog_no_match',
      candidateCount: 0,
    });
    expect(
      resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB'), [
        catalogProduct('air-256-a', 'iPhone 17 Air 256GB'),
        catalogProduct('air-256-b', 'iPhone 17 Air 256GB'),
      ]),
    ).toMatchObject({
      status: 'AMBIGUOUS',
      reason: 'multiple_catalog_candidates',
      candidateCount: 2,
    });
    expect(
      resolveProductIdShadow(supplierIdentity('iPhone 17 Air 256GB'), [
        catalogProduct('air-256', 'iPhone 17 Air 256GB'),
      ]),
    ).toMatchObject({
      status: 'FOUND',
      candidateCount: 1,
    });
  });

  it.each([
    ['128', 'GB'],
    ['256', 'GB'],
    ['512', 'GB'],
    ['1', 'TB'],
    ['2', 'TB'],
  ])('canonicalizes structured storage %s %s against the Core value', (value, unit) => {
    const catalog = [catalogProduct('storage-match', `iPhone 17 Air ${value}${unit}`)];

    expect(
      resolveProductIdShadow(supplierIdentity(`iPhone 17 Air ${value}${unit}`), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'storage-match' });
  });

  it('resolves the real MacBook Air 1TB catalog representation', () => {
    const catalog: ProductIdShadowCandidate[] = [
      {
        id: '69d55709-9750-4eab-9ca5-de2713e22b02',
        productDescription: 'MacBook Air M5 13 16/1TB',
        productType: 'macbook',
        profitCondition: 'novo',
        variantAttributes: null,
        category: { name: 'MacBook' },
        model: { name: 'MacBook Air' },
        color: null,
        storage: { displayName: '1 TB', value: '1', unit: 'TB' },
      },
    ];

    expect(
      resolveProductIdShadow(supplierIdentity('MacBook Air M5 13 16GB 1TB'), catalog),
    ).toMatchObject({
      status: 'FOUND',
      productId: '69d55709-9750-4eab-9ca5-de2713e22b02',
    });
  });

  it('resolves iPad through its canonical chip, screen, storage, connectivity, and condition', () => {
    const catalog = [
      catalogProduct('ipad-11-a16-256-wifi', 'iPad 11 A16 256GB 11" Wi-Fi', 'NOVO', {
        chip: 'A16',
        screen: '11"',
        connectivity: 'Wi-Fi',
      }),
    ];

    expect(
      resolveProductIdShadow(supplierIdentity('iPad 11 A16 11" Wi-Fi 256GB'), catalog),
    ).toMatchObject({ status: 'FOUND', productId: 'ipad-11-a16-256-wifi', candidateCount: 1 });
  });

  it('keeps AirPods Max generations and conditions isolated', () => {
    const catalog = [
      airpodsCatalogProduct('airpods-max-1-new', 'AirPods Max', 'NOVO'),
      airpodsCatalogProduct('airpods-max-2-new', 'AirPods Max 2', 'NOVO'),
    ];

    expect(resolveProductIdShadow(supplierIdentity('AirPods Max'), catalog)).toMatchObject({
      status: 'FOUND',
      productId: 'airpods-max-1-new',
    });
    expect(resolveProductIdShadow(supplierIdentity('AirPods Max 2 A3452'), catalog)).toMatchObject({
      status: 'FOUND',
      productId: 'airpods-max-2-new',
    });
    expect(resolveProductIdShadow(supplierIdentity('AirPods Max 2', 'CPO'), catalog)).toMatchObject({
      status: 'MISSING',
      reason: 'catalog_no_match',
    });
    expect(resolveProductIdShadow(supplierIdentity('A3452'), catalog)).toMatchObject({
      status: 'MISSING',
      reason: 'identity_insufficient',
    });
  });
});
