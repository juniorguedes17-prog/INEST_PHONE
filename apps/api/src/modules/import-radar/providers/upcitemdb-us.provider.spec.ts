import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcItemDbUsProvider, parseUpcItemDbOffers } from './upcitemdb-us.provider';
import { resolveUsaRetailerTaxTreatment } from '../usa-retailer-tax-treatment';

const NOW = Date.parse('2026-09-06T15:00:00.000Z');
const UPC = '0012345678905';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseUpcItemDbOffers', () => {
  it.each([
    ['Best Buy', 'bestbuy.com', 'Best Buy'],
    ['B&H Photo Video', 'bhphotovideo.com', 'B&H Photo Video'],
    ['Adorama', 'adorama.com', 'Adorama'],
  ])('maps a deterministic merchant/domain pair for %s', (merchant, domain, retailer) => {
    const [candidate] = parseUpcItemDbOffers(payload({ merchant, domain }), NOW);

    expect(candidate?.product).toMatchObject({
      id: expect.stringContaining(`:${domain}:`),
      store: merchant,
      retailer,
      priceUsd: 799.99,
      origin: 'US',
    });
  });

  it('keeps Walmart without retailer authority even when merchant and domain match', () => {
    const [candidate] = parseUpcItemDbOffers(
      payload({ merchant: 'Walmart', domain: 'www.walmart.com' }),
      NOW,
    );

    expect(candidate?.product.retailer).toBeNull();
    expect(
      resolveUsaRetailerTaxTreatment({
        retailerEvidence: [
          {
            retailer: candidate?.product.retailer,
            provenance: 'SOURCE_STORE',
            isTrustedRetailer: true,
          },
        ],
      }).taxTreatment,
    ).toBe('UNRESOLVED');
  });

  it('fails closed for an unknown retailer', () => {
    const [candidate] = parseUpcItemDbOffers(
      payload({ merchant: 'Unknown Shop', domain: 'unknown.example' }),
      NOW,
    );
    expect(candidate?.product.retailer).toBeNull();
  });

  it('rejects stale, out-of-stock, invalid-price, and non-USD offers', () => {
    expect(
      parseUpcItemDbOffers(payload({ updated_t: (NOW - 25 * 60 * 60_000) / 1000 }), NOW),
    ).toHaveLength(0);
    expect(parseUpcItemDbOffers(payload({ availability: 'Out of Stock' }), NOW)).toHaveLength(0);
    expect(parseUpcItemDbOffers(payload({ price: 0 }), NOW)).toHaveLength(0);
    expect(parseUpcItemDbOffers(payload({ price: Number.NaN }), NOW)).toHaveLength(0);
    expect(parseUpcItemDbOffers(payload({ currency: 'CAD' }), NOW)).toHaveLength(0);
  });

  it('preserves explicit product identity and manufacturer without Product.id', () => {
    const [candidate] = parseUpcItemDbOffers(payload({}), NOW);

    expect(candidate?.product).toMatchObject({
      externalId: UPC,
      name: 'Example Camera',
      sourceManufacturer: 'Canon',
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      model: 'T7',
      color: 'Black',
      condition: 'NOVO',
      imageUrl: 'https://images.example/item.jpg',
    });
    expect(candidate?.product.id).toBe(
      'upcitemdb-us:0012345678905:best-buy:bestbuy.com:/site/product/example-camera',
    );
  });

  it('does not emit a product without a stable item identity or valid link', () => {
    expect(
      parseUpcItemDbOffers(
        payload({ item: { title: 'No UPC', ean: undefined, upc: undefined, gtin: undefined } }),
        NOW,
      ),
    ).toHaveLength(0);
    expect(parseUpcItemDbOffers(payload({ link: 'not-a-url' }), NOW)).toHaveLength(0);
  });

  it('does not emit malformed or empty API responses', () => {
    expect(parseUpcItemDbOffers({ items: [] }, NOW)).toEqual([]);
    expect(() => parseUpcItemDbOffers({ items: 'invalid' }, NOW)).toThrow(/malformed/);
  });
});

describe('UpcItemDbUsProvider', () => {
  it('uses the official free search endpoint, caches successful results, and adapts to UsaSourceProduct', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(JSON.stringify(payload({}))));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new UpcItemDbUsProvider();

    const first = await provider.searchUsaSourceProducts({ search: 'camera' });
    const second = await provider.searchUsaSourceProducts({ search: 'camera' });

    expect(first).toMatchObject([
      {
        providerName: 'upcitemdb_us',
        source: 'US',
        sourceProductId: expect.stringContaining('upcitemdb-us:'),
        retailer: 'Best Buy',
        priceUsd: 799.99,
      },
    ]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain('/prod/trial/search?s=camera');
  });

  it('returns zero results without calling the API for an empty query', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await new UpcItemDbUsProvider().search({ search: '   ' })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces 429 and timeout as controlled provider failures without retrying', async () => {
    const rateLimited = vi.fn().mockResolvedValue(response('', 429));
    vi.stubGlobal('fetch', rateLimited);
    await expect(new UpcItemDbUsProvider().search({ search: 'camera' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(rateLimited).toHaveBeenCalledTimes(1);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('aborted')));
    await expect(new UpcItemDbUsProvider().search({ search: 'phone' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails controlled for malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('{')));
    await expect(new UpcItemDbUsProvider().search({ search: 'camera' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

function payload(
  overrides: {
    merchant?: string;
    domain?: string;
    price?: number;
    currency?: string;
    availability?: string;
    updated_t?: number;
    link?: string;
    item?: Record<string, unknown>;
  } = {},
) {
  const item = overrides.item ?? {};
  return {
    code: 'OK',
    total: 1,
    offset: 0,
    items: [
      {
        ean: UPC,
        title: 'Example Camera',
        brand: 'Canon',
        model: 'T7',
        color: 'Black',
        category: 'Cameras',
        images: ['https://images.example/item.jpg'],
        offers: [
          {
            merchant: overrides.merchant ?? 'Best Buy',
            domain: overrides.domain ?? 'bestbuy.com',
            title: 'Example Camera offer',
            currency: overrides.currency ?? 'USD',
            price: overrides.price ?? 799.99,
            condition: 'New',
            availability: overrides.availability ?? '',
            link: overrides.link ?? 'https://www.bestbuy.com/site/product/example-camera',
            updated_t: overrides.updated_t ?? NOW / 1000,
          },
        ],
        ...item,
      },
    ],
  };
}

function response(body: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
  };
}
