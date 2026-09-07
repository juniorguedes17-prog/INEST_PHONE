import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';
import { adaptUsaSourceProduct, type UsaSourceProduct } from '../usa-source-product.adapter';
import { compactSourceEvidence } from '../usa-source-evidence';

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

interface AppleConfigurationLink {
  productUrl: string;
  evidence: string;
  priceUsd: number | null;
  capacity: string | null;
  color: string | null;
}

interface AppleStructuredVariant {
  sourceProductId: string;
  sourceName: string;
  priceUsd: number;
  capacity: string;
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

    const expandedProducts = (
      await Promise.all(catalogProducts.map((product) => this.expandCatalogProduct(product)))
    ).flat();

    const products = expandedProducts.filter((product) => {
      const productSearch = normalizeText(
        `${product.name} ${product.sourceEvidence ?? ''} ${product.category} ${product.sourceManufacturer ?? ''}`,
      );
      if (
        search &&
        !search.split(' ').every((token) => productSearch.split(/[^a-z0-9]+/).includes(token))
      )
        return false;
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

  private async expandCatalogProduct(
    catalogProduct: ImportProviderProduct,
  ): Promise<ImportProviderProduct[]> {
    try {
      const detailHtml = await this.fetchPublicCatalog(catalogProduct.productUrl);
      const configuredProducts = parseAppleUsConfiguredProductsHtml(detailHtml, catalogProduct);
      if (configuredProducts.length) return configuredProducts;

      const configurationLinks = parseAppleUsConfigurationLinks(
        detailHtml,
        catalogProduct.productUrl,
      );
      if (!configurationLinks.length) return [catalogProduct];

      const directlyConfiguredProducts = (
        await mapWithConcurrency(configurationLinks, 4, async (link) => {
          try {
            const configurationHtml = await this.fetchPublicCatalog(link.productUrl);
            return parseAppleUsDirectConfigurationHtml(
              configurationHtml,
              catalogProduct,
              link.productUrl,
            );
          } catch {
            return null;
          }
        })
      ).filter((product): product is ImportProviderProduct => product !== null);

      return directlyConfiguredProducts.length ? directlyConfiguredProducts : [catalogProduct];
    } catch {
      // A catalog card remains a fail-closed fallback whenever its public
      // configuration page cannot prove one or more sellable variants.
      return [catalogProduct];
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
      offerKind: 'FAMILY_STARTING_AT',
      sourceEvidence: compactSourceEvidence(
        (content ?? '').replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 '),
      ),
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

/**
 * Produces sellable Apple configurations only when the family page associates
 * a public configuration URL, its displayed price and attributes with exactly
 * one structured Apple variant record from that same page.
 */
export function parseAppleUsConfiguredProductsHtml(
  html: string,
  catalogProduct: ImportProviderProduct,
): ImportProviderProduct[] {
  const structuredVariants = parseAppleStructuredVariants(html);
  if (!structuredVariants.length) return [];

  const products = parseAppleUsConfigurationLinks(html, catalogProduct.productUrl).flatMap(
    (link) => {
      const { capacity, color, priceUsd } = link;
      if (!priceUsd || !capacity || !color) return [];

      const matchedVariants = structuredVariants.filter(
        (variant) =>
          variant.priceUsd === priceUsd &&
          variant.capacity === capacity &&
          containsNormalizedText(variant.sourceName, color),
      );
      if (matchedVariants.length !== 1) return [];

      return [
        createAppleConfiguredProduct(
          catalogProduct,
          matchedVariants[0]!,
          link.productUrl,
          link.evidence,
          link.color,
        ),
      ];
    },
  );

  return uniqueProducts(products);
}

/**
 * Mac configuration links identify the exact configuration in their public
 * URL. Apple exposes the matching name, SKU and USD offer as JSON-LD on that
 * configuration page, so the result never borrows a family starting price.
 */
export function parseAppleUsDirectConfigurationHtml(
  html: string,
  catalogProduct: ImportProviderProduct,
  expectedProductUrl: string,
): ImportProviderProduct | null {
  const expectedUrl = toAppleStoreUrl(expectedProductUrl);
  if (!expectedUrl) return null;

  const variant = parseAppleJsonLdProducts(html).find((product) => {
    const productUrl = optionalAppleUrl(product.url);
    return (
      productUrl === expectedUrl && product.priceUsd !== null && product.sourceProductId !== null
    );
  });
  if (!variant?.sourceName || !variant.sourceProductId || !variant.priceUsd) return null;

  const capacity = extractStorageCapacity(variant.sourceName);
  if (!capacity) return null;

  return createAppleConfiguredProduct(
    catalogProduct,
    {
      sourceProductId: variant.sourceProductId,
      sourceName: variant.sourceName,
      priceUsd: variant.priceUsd,
      capacity,
    },
    expectedUrl,
    variant.sourceName,
    extractAppleColorFromSourceName(variant.sourceName),
  );
}

function parseAppleUsConfigurationLinks(html: string, familyUrl: string): AppleConfigurationLink[] {
  const family = toAppleStoreUrl(familyUrl);
  if (!family) return [];

  const familyPath = new URL(family).pathname.replace(/\/$/, '');
  const links: AppleConfigurationLink[] = [];
  const anchorPattern = /<a\b(?=[^>]*\bhref\s*=\s*"([^"]+)")[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const [, href, content] = match;
    const productUrl = toAppleStoreUrl(href);
    if (!productUrl || !new URL(productUrl).pathname.startsWith(`${familyPath}/`)) continue;

    const evidence = sourceTextFromHtml(content ?? '');
    if (!evidence) continue;

    links.push({
      productUrl,
      evidence,
      priceUsd: parseCurrentUsdPrice(content ?? ''),
      capacity: extractStorageCapacity(
        extractElementText(content ?? '', 'dimensionCapacity') ?? evidence,
      ),
      color: extractElementText(content ?? '', 'dimensionColor'),
    });
  }

  return [...new Map(links.map((link) => [link.productUrl, link])).values()];
}

function parseAppleStructuredVariants(html: string): AppleStructuredVariant[] {
  const variants: AppleStructuredVariant[] = [];
  const pattern =
    /\{\s*"sku"\s*:\s*"[^"]+"\s*,\s*"partNumber"\s*:\s*"([^"]+)"\s*,\s*"price"\s*:\s*\{\s*"fullPrice"\s*:\s*([\d.]+)\s*\}\s*,\s*"category"\s*:\s*"[^"]+"\s*,\s*"name"\s*:\s*"([^"]+)"\s*\}/g;

  for (const match of html.matchAll(pattern)) {
    const [, sourceProductId, rawPrice, rawName] = match;
    const sourceName = cleanSourceText(rawName?.replace(/\\u00a0/gi, ' '));
    const priceUsd = Number(rawPrice);
    const capacity = sourceName ? extractStorageCapacity(sourceName) : null;
    if (
      !sourceProductId ||
      !sourceName ||
      !capacity ||
      !Number.isFinite(priceUsd) ||
      priceUsd <= 0
    ) {
      continue;
    }

    variants.push({
      sourceProductId,
      sourceName,
      priceUsd,
      capacity,
    });
  }

  return variants;
}

function parseAppleJsonLdProducts(html: string) {
  const products: Array<{
    sourceProductId: string | null;
    sourceName: string | null;
    priceUsd: number | null;
    url: string | null;
  }> = [];
  const scriptPattern =
    /<script\b[^>]*\btype\s*=\s*"application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    try {
      const document = JSON.parse(match[1] ?? '') as unknown;
      for (const entry of asArray(document)) {
        if (!isRecord(entry) || entry['@type'] !== 'Product') continue;

        const offers = asArray(entry.offers).filter(isRecord);
        const validOffers = offers.filter(
          (offer) =>
            offer.priceCurrency === 'USD' &&
            typeof offer.price === 'number' &&
            Number.isFinite(offer.price) &&
            offer.price > 0 &&
            typeof offer.sku === 'string',
        );
        if (validOffers.length !== 1) continue;

        const offer = validOffers[0]!;
        products.push({
          sourceProductId: typeof offer.sku === 'string' ? offer.sku : null,
          sourceName: typeof entry.name === 'string' ? cleanSourceText(entry.name) : null,
          priceUsd: typeof offer.price === 'number' ? offer.price : null,
          url: typeof entry.url === 'string' ? entry.url : null,
        });
      }
    } catch {
      // Other public JSON-LD blocks are not configuration offers.
    }
  }

  return products;
}

function createAppleConfiguredProduct(
  catalogProduct: ImportProviderProduct,
  variant: AppleStructuredVariant,
  productUrl: string,
  configurationEvidence: string,
  sourceColor: string | null,
): ImportProviderProduct {
  const model = deriveAppleModel(variant.sourceName, variant.capacity, sourceColor);

  return {
    id: `apple-us:${variant.sourceProductId}`,
    externalId: variant.sourceProductId,
    name: variant.sourceName,
    store: 'Apple Store USA',
    retailer: 'Apple Store USA',
    category: catalogProduct.category,
    priceUsd: variant.priceUsd,
    offerKind: 'CONFIGURED_PRODUCT',
    sourceEvidence: compactSourceEvidence(
      `${variant.sourceName}. ${configurationEvidence}. USD $${variant.priceUsd.toFixed(2)}. Apple part number ${variant.sourceProductId}.`,
    ),
    productUrl,
    sourceManufacturer: 'Apple',
    sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
    origin: 'US',
    condition: 'NOVO',
    ...(model ? { model } : {}),
    ...(variant.capacity ? { capacity: variant.capacity } : {}),
    ...(sourceColor ? { color: sourceColor } : {}),
  };
}

function deriveAppleModel(
  sourceName: string,
  capacity: string,
  color: string | null,
): string | null {
  const sourceModel = sourceName.includes(',')
    ? (sourceName.split(',')[0] ?? sourceName)
    : sourceName;
  const model = removeSourceText(removeSourceText(sourceModel, capacity), color);
  return cleanSourceText(model);
}

function extractStorageCapacity(value: string): string | null {
  const storageMatch = value.match(/\b(\d+(?:\.\d+)?\s*(?:GB|TB))\s+storage\b/i);
  const capacityMatch = storageMatch ?? value.match(/\b(\d+(?:\.\d+)?\s*(?:GB|TB))\b/i);
  return capacityMatch?.[1] ? capacityMatch[1].replace(/\s+/g, '').toUpperCase() : null;
}

function extractAppleColorFromSourceName(value: string): string | null {
  const match = value.match(/,\s*([^,]+),\s*\d+(?:\.\d+)?\s*GB\s+memory\b/i);
  return match?.[1] ? cleanSourceText(match[1]) : null;
}

function extractElementText(html: string, className: string): string | null {
  const pattern = new RegExp(
    `<(?:span|div)\\b[^>]*\\bclass\\s*=\\s*"[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:span|div)>`,
    'i',
  );
  const match = html.match(pattern);
  return match?.[1] ? sourceTextFromHtml(match[1]) : null;
}

function parseCurrentUsdPrice(value: string): number | null {
  const match = value.match(
    /class\s*=\s*"[^"]*current_price[^"]*"[^>]*>[\s\S]*?\$\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  if (!match?.[1]) return null;

  const priceUsd = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null;
}

function sourceTextFromHtml(value: string): string | null {
  return cleanSourceText(
    value.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, ' $1 ').replace(/<[^>]+>/g, ' '),
  );
}

function containsNormalizedText(value: string, expected: string) {
  return normalizeText(value).includes(normalizeText(expected));
}

function removeSourceText(value: string, text: string | null): string {
  if (!text) return value;
  return value.replace(new RegExp(escapeRegExp(text), 'gi'), ' ');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function optionalAppleUrl(value: unknown): string | null {
  return typeof value === 'string' ? toAppleStoreUrl(value) : null;
}

function uniqueProducts(products: ImportProviderProduct[]) {
  return [...new Map(products.map((product) => [product.id, product])).values()];
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await mapper(values[index]!);
      }
    }),
  );
  return results;
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
