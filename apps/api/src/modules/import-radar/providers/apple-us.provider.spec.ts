import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveUsaRetailerTaxTreatment } from '../usa-retailer-tax-treatment';
import { AppleUsProvider, parseAppleUsCatalogHtml } from './apple-us.provider';

const iphoneCatalogHtml = `
  <a href="/shop/buy-iphone/iphone-example" data-display-name="iPhone&nbsp;Example" data-part-number="IPHONE_EXAMPLE_MAIN">
    <div class="rf-hcard-scrim-price price">Buy from <span class="nowrap">$999</span></div>
  </a>`;

const macCatalogHtml = `
  <a href="/shop/buy-mac/macbook-example" data-display-name="MacBook&nbsp;Example" data-part-number="MACBOOK_EXAMPLE_MAIN">
    <div class="rf-hcard-scrim-price price">Buy from <span class="nowrap">$1,299</span></div>
  </a>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppleUsProvider', () => {
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
