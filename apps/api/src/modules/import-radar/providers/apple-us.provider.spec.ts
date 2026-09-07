import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveUsaRetailerTaxTreatment } from '../usa-retailer-tax-treatment';
import {
  AppleUsProvider,
  parseAppleUsCatalogHtml,
  parseAppleUsConfiguredProductsHtml,
  parseAppleUsDirectConfigurationHtml,
} from './apple-us.provider';

const iphoneCatalogHtml = `
  <a href="/shop/buy-iphone/iphone-example" data-display-name="iPhone&nbsp;Example" data-part-number="IPHONE_EXAMPLE_MAIN">
    <div class="rf-hcard-scrim-price price">Buy from <span class="nowrap">$999</span></div>
  </a>`;

const macCatalogHtml = `
  <a href="/shop/buy-mac/macbook-example" data-display-name="MacBook&nbsp;Example" data-part-number="MACBOOK_EXAMPLE_MAIN">
    <div class="rf-hcard-scrim-price price">Buy from <span class="nowrap">$1,299</span></div>
  </a>`;

const iphone17ProFamilyCatalogHtml = `
  <a href="/shop/buy-iphone/iphone-17-pro" data-display-name="iPhone 17 Pro Main" data-part-number="IPHONE17PRO_MAIN">
    <h2>iPhone 17 Pro and iPhone 17 Pro Max</h2>
    <div class="rf-hcard-scrim-price">Buy from $1,099</div>
  </a>`;

const iphone17ProVariantHtml = `
  <a href="/shop/buy-iphone/iphone-17-pro/6.3-inch-display-256gb-cosmic-orange-unlocked">
    <span class="dimensionCapacity">256<small>GB</small></span>
    <span class="dimensionColor">Cosmic Orange</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,099.00</span></span>
  </a>
  <a href="/shop/buy-iphone/iphone-17-pro/6.3-inch-display-512gb-cosmic-orange-unlocked">
    <span class="dimensionCapacity">512<small>GB</small></span>
    <span class="dimensionColor">Cosmic Orange</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,299.00</span></span>
  </a>
  <a href="/shop/buy-iphone/iphone-17-pro/6.9-inch-display-256gb-silver-unlocked">
    <span class="dimensionCapacity">256<small>GB</small></span>
    <span class="dimensionColor">Silver</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,199.00</span></span>
  </a>
  <a href="/shop/buy-iphone/iphone-17-pro/6.9-inch-display-512gb-silver-unlocked">
    <span class="dimensionCapacity">512<small>GB</small></span>
    <span class="dimensionColor">Silver</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,399.00</span></span>
  </a>
  <a href="/shop/buy-iphone/iphone-17-pro/6.9-inch-display-1tb-deep-blue-unlocked">
    <span class="dimensionCapacity">1<small>TB</small></span>
    <span class="dimensionColor">Deep Blue</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,599.00</span></span>
  </a>
  <a href="/shop/buy-iphone/iphone-17-pro/6.9-inch-display-2tb-deep-blue-unlocked">
    <span class="dimensionCapacity">2<small>TB</small></span>
    <span class="dimensionColor">Deep Blue</span>
    <span class="carrier-logos">Connect on your own later.</span>
    <span class="price"><span class="current_price">$1,999.00</span></span>
  </a>
  <script>
    window.appleVariants = [
      {"sku":"MG7L4","partNumber":"MG7L4LL/A","price":{"fullPrice":1099},"category":"iphone","name":"iPhone 17 Pro 256GB Cosmic Orange"},
      {"sku":"MG7N4","partNumber":"MG7N4LL/A","price":{"fullPrice":1299},"category":"iphone","name":"iPhone 17 Pro 512GB Cosmic Orange"},
      {"sku":"MFXG4","partNumber":"MFXG4LL/A","price":{"fullPrice":1199},"category":"iphone","name":"iPhone 17 Pro Max 256GB Silver"},
      {"sku":"MFXK4","partNumber":"MFXK4LL/A","price":{"fullPrice":1399},"category":"iphone","name":"iPhone 17 Pro Max 512GB Silver"},
      {"sku":"MFXQ4","partNumber":"MFXQ4LL/A","price":{"fullPrice":1599},"category":"iphone","name":"iPhone 17 Pro Max 1TB Deep Blue"},
      {"sku":"MFXU4","partNumber":"MFXU4LL/A","price":{"fullPrice":1999},"category":"iphone","name":"iPhone 17 Pro Max 2TB Deep Blue"}
    ];
  </script>`;

const macbookAirFamilyCatalogHtml = `
  <a href="/shop/buy-mac/macbook-air" data-display-name="MacBook Air" data-part-number="MACBOOK_AIR_MAIN">
    <div class="rf-hcard-scrim-price price">Buy from <span class="nowrap">$1,299</span></div>
  </a>`;

const macbookAirVariantPageHtml = `
  <script type="application/ld+json">
    {
      "@context":"https://schema.org",
      "@type":"Product",
      "name":"MacBook Air, 13-inch, M5 Chip, 10-core CPU, 10-core GPU, Starlight, 16GB memory, 1TB storage",
      "url":"https://www.apple.com/shop/buy-mac/macbook-air/13-inch-starlight-m5-chip-10-core-cpu-10-core-gpu-16gb-memory-1tb-storage",
      "offers":[{"@type":"Offer","priceCurrency":"USD","price":1599,"sku":"MDHC4LL/A"}]
    }
  </script>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppleUsProvider', () => {
  it('returns a legitimate EMPTY for CAMERA within the supported family catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(iphoneCatalogHtml))
        .mockResolvedValueOnce(response(macCatalogHtml)),
    );
    expect(await new AppleUsProvider().searchUsaSourceProducts({ search: 'CAMERA' })).toEqual([]);
  });
  it('finds Pro Max in family evidence but never promotes the starting price to a configuration', async () => {
    const familyHtml = `<a href="/shop/buy-iphone/iphone-17-pro" data-display-name="iPhone 17 Pro Main" data-part-number="IPHONE17PRO_MAIN"><h2>iPhone 17 Pro and iPhone 17 Pro Max</h2><div class="rf-hcard-scrim-price">Buy from $1,099</div></a>`;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(familyHtml))
        .mockResolvedValueOnce(response(macCatalogHtml)),
    );
    const [family] = await new AppleUsProvider().searchUsaSourceProducts({
      search: 'IPHONE 17 PRO MAX',
    });
    expect(family).toMatchObject({
      sourceProductId: 'apple-us:IPHONE17PRO_MAIN',
      offerKind: 'FAMILY_STARTING_AT',
      priceUsd: 1099,
    });
    expect(family?.sourceEvidence).toContain('iPhone 17 Pro Max');
    expect(family?.sourceEvidence).not.toContain('<');
    expect(family).not.toHaveProperty('capacity');
  });
  it('returns only Apple configurations whose URL, attributes, identifier, and price agree in the public family page', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/us/shop/buy-iphone')
        return Promise.resolve(response(iphone17ProFamilyCatalogHtml));
      if (path === '/us/shop/buy-mac') return Promise.resolve(response(macCatalogHtml));
      if (path === '/shop/buy-iphone/iphone-17-pro')
        return Promise.resolve(response(iphone17ProVariantHtml));
      return Promise.resolve(response('<html></html>'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const products = await new AppleUsProvider().search({ search: 'iPhone 17 Pro' });

    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'iPhone 17 Pro 256GB Cosmic Orange',
          model: 'iPhone 17 Pro',
          capacity: '256GB',
          color: 'Cosmic Orange',
          priceUsd: 1099,
          externalId: 'MG7L4LL/A',
          offerKind: 'CONFIGURED_PRODUCT',
        }),
        expect.objectContaining({
          name: 'iPhone 17 Pro 512GB Cosmic Orange',
          model: 'iPhone 17 Pro',
          capacity: '512GB',
          priceUsd: 1299,
          offerKind: 'CONFIGURED_PRODUCT',
        }),
        expect.objectContaining({
          name: 'iPhone 17 Pro Max 256GB Silver',
          model: 'iPhone 17 Pro Max',
          capacity: '256GB',
          priceUsd: 1199,
          offerKind: 'CONFIGURED_PRODUCT',
        }),
        expect.objectContaining({
          name: 'iPhone 17 Pro Max 512GB Silver',
          model: 'iPhone 17 Pro Max',
          capacity: '512GB',
          priceUsd: 1399,
          offerKind: 'CONFIGURED_PRODUCT',
        }),
        expect.objectContaining({
          name: 'iPhone 17 Pro Max 1TB Deep Blue',
          model: 'iPhone 17 Pro Max',
          capacity: '1TB',
          priceUsd: 1599,
          offerKind: 'CONFIGURED_PRODUCT',
        }),
        expect.objectContaining({
          name: 'iPhone 17 Pro Max 2TB Deep Blue',
          model: 'iPhone 17 Pro Max',
          capacity: '2TB',
          priceUsd: 1999,
          offerKind: 'CONFIGURED_PRODUCT',
        }),
      ]),
    );
    expect(products).toHaveLength(6);
    expect(products.every((product) => product.sourceEvidence?.includes('Apple part number'))).toBe(
      true,
    );
  });
  it('parses a direct public Mac configuration only when its JSON-LD provides the exact name, SKU, and USD price', () => {
    const [catalogProduct] = parseAppleUsCatalogHtml(macbookAirFamilyCatalogHtml, 'Mac');
    const product = parseAppleUsDirectConfigurationHtml(
      macbookAirVariantPageHtml,
      catalogProduct!,
      'https://www.apple.com/shop/buy-mac/macbook-air/13-inch-starlight-m5-chip-10-core-cpu-10-core-gpu-16gb-memory-1tb-storage',
    );

    expect(product).toMatchObject({
      name: 'MacBook Air, 13-inch, M5 Chip, 10-core CPU, 10-core GPU, Starlight, 16GB memory, 1TB storage',
      model: 'MacBook Air',
      capacity: '1TB',
      color: 'Starlight',
      priceUsd: 1599,
      externalId: 'MDHC4LL/A',
      offerKind: 'CONFIGURED_PRODUCT',
    });
    expect(product?.sourceEvidence).toContain('16GB memory');
    expect(product?.sourceEvidence).toContain('1TB storage');
    expect(product?.sourceEvidence).toContain('USD $1599.00');
  });
  it('does not duplicate an Apple configuration when the same public link appears more than once', () => {
    const [catalogProduct] = parseAppleUsCatalogHtml(iphone17ProFamilyCatalogHtml, 'iPhone');
    const duplicateLink = iphone17ProVariantHtml.slice(
      0,
      iphone17ProVariantHtml.indexOf('</a>') + '</a>'.length,
    );
    const products = parseAppleUsConfiguredProductsHtml(
      `${duplicateLink}${iphone17ProVariantHtml}`,
      catalogProduct!,
    );

    expect(products).toHaveLength(6);
    expect(new Set(products.map((product) => product.id)).size).toBe(6);
  });
  it('keeps the family fallback when the public detail page does not prove a configuration', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const path = new URL(String(input)).pathname;
      if (path === '/us/shop/buy-iphone')
        return Promise.resolve(response(iphone17ProFamilyCatalogHtml));
      if (path === '/us/shop/buy-mac') return Promise.resolve(response(macCatalogHtml));
      return Promise.resolve(response('<html></html>'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const [family] = await new AppleUsProvider().search({ search: 'iPhone 17 Pro Max' });

    expect(family).toMatchObject({
      offerKind: 'FAMILY_STARTING_AT',
      priceUsd: 1099,
      externalId: 'IPHONE17PRO_MAIN',
    });
  });
  it('parses only public cards with an associated source ID, name, USD price, and product URL', () => {
    const first = parseAppleUsCatalogHtml(iphoneCatalogHtml, 'iPhone');
    const second = parseAppleUsCatalogHtml(iphoneCatalogHtml, 'iPhone');

    expect(first).toEqual([
      expect.objectContaining({
        id: 'apple-us:IPHONE_EXAMPLE_MAIN',
        externalId: 'IPHONE_EXAMPLE_MAIN',
        name: 'iPhone Example',
        category: 'iPhone',
        priceUsd: 999,
        productUrl: 'https://www.apple.com/shop/buy-iphone/iphone-example',
        retailer: 'Apple Store USA',
        sourceManufacturer: 'Apple',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        origin: 'US',
        condition: 'NOVO',
      }),
    ]);
    expect(second[0]!.id).toBe(first[0]!.id);
    expect(first[0]).not.toHaveProperty('model');
    expect(first[0]).not.toHaveProperty('capacity');
    expect(first[0]).not.toHaveProperty('imageUrl');
  });

  it('does not emit incomplete, ambiguous, or invalidly priced cards', () => {
    expect(() =>
      parseAppleUsCatalogHtml('<a data-part-number="NO_PRICE">Broken</a>', 'iPhone'),
    ).toThrow('No valid Apple Store USA iPhone catalog cards were found.');
    expect(() =>
      parseAppleUsCatalogHtml(
        '<a href="/shop/buy-iphone/example" data-display-name="No ID"><div class="rf-hcard-scrim-price">Buy from $999</div></a>',
        'iPhone',
      ),
    ).toThrow('No valid Apple Store USA iPhone catalog cards were found.');
    expect(() =>
      parseAppleUsCatalogHtml(
        '<a href="/shop/buy-iphone/example" data-display-name="Multiple prices" data-part-number="MULTIPLE_PRICES"><div class="rf-hcard-scrim-price">Buy from $999</div><div class="rf-hcard-scrim-price">Buy from $1,199</div></a>',
        'iPhone',
      ),
    ).toThrow('No valid Apple Store USA iPhone catalog cards were found.');
  });

  it('searches the Apple public iPhone and Mac catalogs, with a defensive cache', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(iphoneCatalogHtml))
      .mockResolvedValueOnce(response(macCatalogHtml));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new AppleUsProvider();

    const first = await provider.search({ search: 'Apple' });
    const second = await provider.search({ search: 'Apple' });

    expect(first).toEqual([
      expect.objectContaining({ id: 'apple-us:IPHONE_EXAMPLE_MAIN', priceUsd: 999 }),
      expect.objectContaining({ id: 'apple-us:MACBOOK_EXAMPLE_MAIN', priceUsd: 1299 }),
    ]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) });
  });

  it('adapts the provider result into the P6A USA source product contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(iphoneCatalogHtml))
        .mockResolvedValueOnce(response(macCatalogHtml)),
    );
    const provider = new AppleUsProvider();

    const [result] = await provider.searchUsaSourceProducts({ search: 'iPhone' });

    expect(result).toMatchObject({
      providerName: 'apple_us',
      source: 'US',
      sourceProductId: 'apple-us:IPHONE_EXAMPLE_MAIN',
      sourceName: 'iPhone Example',
      retailer: 'Apple Store USA',
      sourceManufacturer: 'Apple',
      priceUsd: 999,
    });
    expect(result).not.toHaveProperty('productId');
    expect(result).not.toHaveProperty('priceBrl');
    expect(result).not.toHaveProperty('finalCost');
    expect(result).not.toHaveProperty('taxBrl');
    expect(result).not.toHaveProperty('shippingUsd');
  });

  it('is structurally compatible with the existing Apple Store USA TAX treatment', () => {
    const [product] = parseAppleUsCatalogHtml(iphoneCatalogHtml, 'iPhone');
    const result = resolveUsaRetailerTaxTreatment({
      redirector: 'REI_DO_IMPORTADO',
      retailerEvidence: [
        {
          retailer: product!.retailer,
          provenance: 'SOURCE_STORE',
          isTrustedRetailer: true,
        },
      ],
    });

    expect(result).toMatchObject({
      taxTreatment: 'TAXABLE',
      retailer: { retailerKey: 'apple-store-usa' },
    });
  });

  it('fails with a controlled provider error when Apple is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('', 503)));
    const provider = new AppleUsProvider();

    await expect(provider.search({ search: 'iPhone' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

function response(body: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}
