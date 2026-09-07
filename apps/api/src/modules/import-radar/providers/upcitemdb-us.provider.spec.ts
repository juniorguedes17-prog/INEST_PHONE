import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpcItemDbUsProvider, parseUpcItemDbOffers } from './upcitemdb-us.provider';
import { resolveUsaRetailerTaxTreatment } from '../usa-retailer-tax-treatment';

const NOW = Date.parse('2026-09-06T15:00:00.000Z');
const UPC = '0012345678905';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('parseUpcItemDbOffers', () => {
  it('preserves the offer title and raw condition as compact evidence', () => {
    const [candidate] = parseUpcItemDbOffers(payload({}), NOW);
    expect(candidate?.product.sourceEvidence).toBe('Example Camera offer New');
  });
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
        redirector: 'REI_DO_IMPORTADO',
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
  it('honors the server reset after 429 without making a retry request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue({
      ...response('', 429),
      headers: new Headers({
        'x-ratelimit-reset': String((NOW + 3600_000) / 1000),
        'retry-after': '60',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new UpcItemDbUsProvider();
    await expect(provider.search({ search: 'camera' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(provider.search({ search: 'phone' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['CAMERA', 'IPHONE 17 PRO MAX'])(
    'finds a fresh offer beyond an ineligible first page for %s',
    async (search) => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          response(
            JSON.stringify({
              ...payload({ updated_t: (NOW - 25 * 3600_000) / 1000 }),
              total: 3278,
              offset: 5,
            }),
          ),
        )
        .mockResolvedValueOnce(response(JSON.stringify(payload({}))));
      vi.stubGlobal('fetch', fetchMock);
      const resultPromise = new UpcItemDbUsProvider().searchUsaWithDiagnostics({ search });
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await resultPromise;
      expect(result.products).toHaveLength(1);
      expect(result.report.diagnostics).toMatchObject({
        pages: 2,
        emitted: 1,
        stopReason: 'NO_NEXT_PAGE',
        discarded: { stale: 1 },
      });
    },
  );
  it('CAMERA follows the documented next offset, dedupes across pages and stops at two pages rather than total 3278', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const first = { ...payload({}), total: 3278, offset: 5 };
    const second = { ...payload({}), total: 3278, offset: 10 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(JSON.stringify(first)))
      .mockResolvedValueOnce(response(JSON.stringify(second)));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new UpcItemDbUsProvider();
    const pending = provider.searchUsaWithDiagnostics({ search: 'CAMERA' });
    const repeated = provider.searchUsaWithDiagnostics({ search: 'CAMERA' });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect((await repeated).products).toEqual(result.products);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('offset=5');
    expect(result.products).toHaveLength(1);
    expect(result.report.diagnostics).toMatchObject({
      totalDeclared: 3278,
      pages: 2,
      itemsReceived: 2,
      offersEvaluated: 2,
      emitted: 1,
      stopReason: 'PAGE_BUDGET',
    });
    await provider.searchUsaWithDiagnostics({ search: 'camera' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([429, 503])('preserves page one when page two returns %s', async (status) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(JSON.stringify({ ...payload({}), total: 3278, offset: 5 })))
      .mockResolvedValueOnce(response('', status));
    vi.stubGlobal('fetch', fetchMock);
    const resultPromise = new UpcItemDbUsProvider().searchUsaWithDiagnostics({ search: 'camera' });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;
    expect(result.products).toHaveLength(1);
    expect(result.report.status).toBe(status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops after enough eligible offers; keeps unknown retailer and records each discard reason', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const base = payload({ merchant: 'Unknown Shop', domain: 'unknown.example' });
    const offer = base.items[0]!.offers[0]!;
    base.items[0]!.offers = [
      ...Array.from({ length: 10 }, (_, index) => ({
        ...offer,
        link: `https://unknown.example/${index}`,
      })),
      { ...offer, updated_t: (NOW - 25 * 3600_000) / 1000 },
      { ...offer, currency: 'CAD' },
      { ...offer, price: 0 },
      { ...offer, link: 'bad-url' },
      { ...offer, merchant: '' },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(JSON.stringify({ ...base, offset: 5, total: 3278 })));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new UpcItemDbUsProvider().searchUsaWithDiagnostics({ search: 'camera' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.products).toHaveLength(10);
    expect(result.products.every((item) => item.retailer === null)).toBe(true);
    expect(result.report.diagnostics).toMatchObject({
      stopReason: 'ENOUGH_CANDIDATES',
      discarded: { stale: 1, currency: 1, price: 1, url: 1, malformed: 1 },
    });
  });

  it('protects the FREE burst budget across different searches without another network call', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const fetchMock = vi.fn().mockResolvedValue(response(JSON.stringify(payload({}))));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new UpcItemDbUsProvider();
    await provider.search({ search: 'camera' });
    await expect(provider.search({ search: 'phone' })).rejects.toMatchObject({
      report: { status: 'RATE_LIMITED' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
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
