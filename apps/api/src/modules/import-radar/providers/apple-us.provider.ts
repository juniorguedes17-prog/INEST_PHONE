import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';
import { adaptUsaSourceProduct, type UsaSourceProduct } from '../usa-source-product.adapter';

const APPLE_STORE_US_BASE_URL = 'https://www.apple.com';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;

const appleCatalogs = [
  { url: '/us/shop/buy-iphone', category: 'iPhone' },
  { url: '/us/shop/buy-mac', category: 'Mac' },
] as const;

interface CacheEntry {
  expiresAt: number;
  products: ImportProviderProduct[];
}

/**
 * Public Apple Store USA catalog provider. It reads only the structured
 * product cards rendered by Apple's own public catalog pages; it never uses
 * authentication, private APIs, browser automation, or checkout data.
 */
@Injectable()
export class AppleUsProvider implements ImportProvider {
  readonly name = 'apple_us';
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    const search = normalizeText(query.search ?? '');
    const category = normalizeText(query.category ?? '');
    if (!search && !category) return [];

    const cacheKey = `${search}|${category}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.products;

    let catalogProducts: ImportProviderProduct[];
    try {
      const responses = await Promise.all(
        appleCatalogs.map(async (catalog) => ({
          catalog,
          html: await this.fetchPublicCatalog(catalog.url),
        })),
      );
      catalogProducts = responses.flatMap(({ catalog, html }) =>
        parseAppleUsCatalogHtml(html, catalog.category),
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        `Apple Store USA indisponivel no momento: ${getErrorMessage(error)}`,
      );
    }

    const products = catalogProducts.filter((product) => {
      const productSearch = normalizeText(
        `${product.name} ${product.category} ${product.sourceManufacturer ?? ''}`,
      );
      if (search && !productSearch.includes(search)) return false;
      return !category || normalizeText(product.category) === category;
    });

    this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, products });
    return products;
  }

  /**
   * Explicit P6A handoff for the future USA pipeline. Existing PY/BR search
   * behavior remains untouched because this method is not routed by it yet.
   */
  async searchUsaSourceProducts(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]> {
    return (await this.search(query)).map((product) =>
      adaptUsaSourceProduct({ providerName: this.name, product }),
    );
  }

  private async fetchPublicCatalog(path: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(new URL(path, APPLE_STORE_US_BASE_URL), {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'iNestPhone-PriceRadar/1.0 (+public-price-consultation)',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      if (!html.trim()) throw new Error('Empty public catalog response');
      return html;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Parses only an Apple public catalog card when all source-owned fields are
 * associated in the same anchor: part number, display name, product URL, and
 * its advertised starting USD price. Partial or ambiguous cards are skipped.
 */
export function parseAppleUsCatalogHtml(
  html: string,
  category: 'iPhone' | 'Mac',
): ImportProviderProduct[] {
  const products: ImportProviderProduct[] = [];
  const cardPattern =
    /<a\b(?=[^>]*\bhref\s*=\s*"([^"]+)")(?=[^>]*\bdata-display-name\s*=\s*"([^"]+)")(?=[^>]*\bdata-part-number\s*=\s*"([^"]+)")[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(cardPattern)) {
    const [, href, displayName, partNumber, content] = match;
    const sourceName = cleanSourceText(displayName);
    const sourceProductId = cleanSourceText(partNumber);
    const priceUsd = parseAdvertisedUsdPrice(content ?? '');
    const productUrl = toAppleStoreUrl(href);
    if (!sourceName || !sourceProductId || !priceUsd || !productUrl) continue;

    products.push({
      id: `apple-us:${sourceProductId}`,
      externalId: sourceProductId,
      name: sourceName,
      store: 'Apple Store USA',
      retailer: 'Apple Store USA',
      category,
      priceUsd,
      productUrl,
      sourceManufacturer: 'Apple',
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      origin: 'US',
      // Apple's directly sold Buy catalog is explicitly a new-product catalog.
      condition: 'NOVO',
    });
  }

  const unique = new Map(products.map((product) => [product.id, product]));
  if (!unique.size) {
    throw new Error(`No valid Apple Store USA ${category} catalog cards were found.`);
  }
  return [...unique.values()];
}

function parseAdvertisedUsdPrice(value: string): number | null {
  const priceMatches = [
    ...value.matchAll(
      /class\s*=\s*"[^"]*rf-hcard-scrim-price[^"]*"[\s\S]*?\$\s*([\d,]+(?:\.\d{1,2})?)/gi,
    ),
  ];
  if (priceMatches.length !== 1) return null;

  const priceContainer = priceMatches[0];
  if (!priceContainer?.[1]) return null;

  const priceUsd = Number(priceContainer[1].replace(/,/g, ''));
  return Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null;
}

function toAppleStoreUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, APPLE_STORE_US_BASE_URL);
    return url.hostname === 'www.apple.com' && url.pathname.startsWith('/shop/buy-')
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function cleanSourceText(value: string | undefined): string | null {
  const decoded = (value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || null;
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
    .trim();
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
