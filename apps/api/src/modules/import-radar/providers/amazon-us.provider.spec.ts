import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveUsaRetailerTaxTreatment } from '../usa-retailer-tax-treatment';
import {
  AmazonUsProvider,
  parseAmazonUsDetailHtml,
  parseAmazonUsSearchHtml,
} from './amazon-us.provider';

const searchHtml = `
  <div data-asin="AMAZON0001" data-component-type="s-search-result" class="s-result-item">
    <div data-category="CELL_PHONES"></div>
  </div>
  <div data-asin="MARKET0001" data-component-type="s-search-result" class="s-result-item">
    <div data-category="CELL_PHONES"></div>
  </div>
  <div data-asin="AD00000001" data-component-type="s-search-result" class="s-result-item AdHolder">
    <div data-category="CELL_PHONES"></div>
  </div>`;

const amazonDetailHtml = `
  <meta name="title" content="Example&nbsp;Phone">
  <div id="corePriceDisplay_mobile_feature_div">
    <span class="priceToPay">
      <span class="a-price-symbol">$</span>
      <span class="a-price-whole">999<span class="a-price-decimal">.</span></span>
      <span class="a-price-fraction">50</span>
    </span>
  </div>
  <div id="merchantInfoFeature_feature_div">
    <div offer-display-attribute-name="mobile-merchant-info">
      <span class="offer-display-feature-text-message">Amazon.com</span>
    </div>
  </div>`;

const marketplaceDetailHtml = `
  <span id="productTitle">Marketplace Phone</span>
  <div id="corePriceDisplay_mobile_feature_div">
    <span class="a-offscreen">$999.50</span>
  </div>
  <div id="merchantInfoFeature_feature_div">
    <div offer-display-attribute-name="mobile-merchant-info">
      <span class="offer-display-feature-text-message">Third Party Seller</span>
    </div>
  </div>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AmazonUsProvider', () => {
  it('discovers only source-owned non-ad ASINs with one structured category', () => {
    expect(parseAmazonUsSearchHtml(searchHtml)).toEqual([
      { asin: 'AMAZON0001', category: 'CELL_PHONES' },
      { asin: 'MARKET0001', category: 'CELL_PHONES' },
    ]);
  });

  it('emits an Amazon offer only when its public buy-box explicitly identifies Amazon.com', () => {
    const product = parseAmazonUsDetailHtml(amazonDetailHtml, {
      asin: 'AMAZON0001',
      category: 'CELL_PHONES',
    });

    expect(product).toMatchObject({
      id: 'amazon-us:AMAZON0001',
      externalId: 'AMAZON0001',
      name: 'Example Phone',
      retailer: 'Amazon',
      store: 'Amazon USA',
      category: 'CELL_PHONES',
      priceUsd: 999.5,
      productUrl: 'https://www.amazon.com/dp/AMAZON0001',
      origin: 'US',
    });
    expect(product).not.toHaveProperty('sourceManufacturer');
    expect(product).not.toHaveProperty('condition');
  });

  it('fails closed for a marketplace seller, a missing seller, conditional pricing, or multiple prices', () => {
    const candidate = { asin: 'MARKET0001', category: 'CELL_PHONES' };
    expect(parseAmazonUsDetailHtml(marketplaceDetailHtml, candidate)).toBeNull();
    expect(
      parseAmazonUsDetailHtml(amazonDetailHtml.replace('Amazon.com', 'Unknown Seller'), candidate),
    ).toBeNull();
    expect(
      parseAmazonUsDetailHtml(
        amazonDetailHtml.replace(
          '<span class="a-price-fraction">50</span>',
          '<span class="a-price-fraction">50</span> coupon',
        ),
        candidate,
      ),
    ).toBeNull();
    expect(
      parseAmazonUsDetailHtml(
        amazonDetailHtml.replace(
          '</div>\n  <div id="merchantInfoFeature',
          '<span class="priceToPay"><span class="a-price-symbol">$</span><span class="a-price-whole">899<span class="a-price-decimal">.</span></span><span class="a-price-fraction">50</span></span></div>\n  <div id="merchantInfoFeature',
        ),
        candidate,
      ),
    ).toBeNull();
  });

  it('searches public pages, verifies the seller per offer, and caches verified results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(searchHtml))
      .mockResolvedValueOnce(response(amazonDetailHtml))
      .mockResolvedValueOnce(response(marketplaceDetailHtml));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new AmazonUsProvider();

    const first = await provider.search({ search: 'phone' });
    const second = await provider.search({ search: 'phone' });

    expect(first).toEqual([expect.objectContaining({ id: 'amazon-us:AMAZON0001' })]);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain('/s?k=phone');
  });

  it('adapts a verified offer into the P6A USA source product contract without Product.id', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response(searchHtml))
        .mockResolvedValueOnce(response(amazonDetailHtml))
        .mockResolvedValueOnce(response(marketplaceDetailHtml)),
    );
    const provider = new AmazonUsProvider();

    const [result] = await provider.searchUsaSourceProducts({ search: 'phone' });

    expect(result).toMatchObject({
      providerName: 'amazon_us',
      source: 'US',
      sourceProductId: 'amazon-us:AMAZON0001',
      sourceName: 'Example Phone',
      retailer: 'Amazon',
      priceUsd: 999.5,
    });
    expect(result).not.toHaveProperty('productId');
    expect(result).not.toHaveProperty('priceBrl');
    expect(result).not.toHaveProperty('taxBrl');
    expect(result).not.toHaveProperty('shippingUsd');
  });

  it('is structurally compatible with the existing Amazon EXEMPT tax treatment', () => {
    const product = parseAmazonUsDetailHtml(amazonDetailHtml, {
      asin: 'AMAZON0001',
      category: 'CELL_PHONES',
    });
    const result = resolveUsaRetailerTaxTreatment({
      retailerEvidence: [
        {
          retailer: product!.retailer,
          provenance: 'SOURCE_STORE',
          isTrustedRetailer: true,
        },
      ],
    });

    expect(result).toMatchObject({
      taxTreatment: 'EXEMPT',
      retailer: { retailerKey: 'amazon' },
    });
  });

  it('fails with a controlled provider error when Amazon search is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('', 503)));
    const provider = new AmazonUsProvider();

    await expect(provider.search({ search: 'phone' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

function response(body: string, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}
