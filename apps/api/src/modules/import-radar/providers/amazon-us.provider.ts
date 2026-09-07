import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';
import { adaptUsaSourceProduct, type UsaSourceProduct } from '../usa-source-product.adapter';
import type { UsaProviderReport, UsaProviderSearchResult } from '../usa-search-result';

const AMAZON_US_BASE_URL = 'https://www.amazon.com';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;

interface AmazonSearchCandidate {
  asin: string;
  category: string;
}

interface CacheEntry {
  expiresAt: number;
  products: ImportProviderProduct[];
  report: UsaProviderReport;
}

/**
 * Public Amazon USA provider. Results are emitted only when Amazon's own
 * public buy-box identifies Amazon.com as the seller. Marketplace, conditional
 * prices, malformed source markup, and incomplete offers are skipped.
 */
@Injectable()
export class AmazonUsProvider implements ImportProvider {
  readonly name = 'amazon_us';
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    const search = normalizeText(query.search ?? '');
    if (!search) return [];

    const cached = this.cache.get(search);
    if (cached && cached.expiresAt > Date.now()) return cached.products;

    try {
      const searchHtml = await this.fetchPublicPage(`/s?k=${encodeURIComponent(search)}`);
      const candidates = parseAmazonUsSearchHtml(searchHtml);
      let failedDetails = 0;
      const detailed = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            const detailHtml = await this.fetchPublicPage(`/dp/${candidate.asin}`);
            return parseAmazonUsDetailHtml(detailHtml, candidate);
          } catch {
            failedDetails++;
            // A source item that cannot be verified must not make another
            // independently verifiable item eligible by association.
            return null;
          }
        }),
      );

      const products = detailed.filter(
        (product): product is ImportProviderProduct => product !== null,
      );
      this.cache.set(search, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        products,
        report: {
          provider: this.name,
          status: failedDetails ? 'UNAVAILABLE' : products.length ? 'OK' : 'EMPTY',
          returnedCount: products.length,
          diagnostics: {
            scope: 'PUBLIC_FIRST_PAGE_VERIFIED_PDP',
            candidates: candidates.length,
            failedDetails,
            rejectedOffers: candidates.length - failedDetails - products.length,
          },
        },
      });
      return products;
    } catch (error) {
      throw new ServiceUnavailableException(
        `Amazon USA indisponivel no momento: ${getErrorMessage(error)}`,
      );
    }
  }

  /** Explicit P6A handoff; it does not route the existing BR/PY Radar. */
  async searchUsaWithDiagnostics(query: ImportSearchQueryDto): Promise<UsaProviderSearchResult> {
    const products = await this.searchUsaSourceProducts(query);
    return {
      products,
      report: this.cache.get(normalizeText(query.search ?? ''))?.report ?? {
        provider: this.name,
        status: products.length ? 'OK' : 'EMPTY',
        returnedCount: products.length,
      },
    };
  }

  async searchUsaSourceProducts(query: ImportSearchQueryDto): Promise<UsaSourceProduct[]> {
    return (await this.search(query)).map((product) =>
      adaptUsaSourceProduct({ providerName: this.name, product }),
    );
  }

  private async fetchPublicPage(path: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(new URL(path, AMAZON_US_BASE_URL), {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'iNestPhone-PriceRadar/1.0 (+public-price-consultation)',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      if (!html.trim()) throw new Error('Empty public Amazon response');
      if (
        /validateCaptcha|\/errors\/validateCaptcha|Robot Check|<title>\s*Robot or human/i.test(html)
      ) {
        throw new Error('Public Amazon challenge');
      }
      return html;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Search results are used only to discover Amazon-owned ASINs and their
 * structured source category. The price and seller always come from the
 * corresponding public product buy-box.
 */
export function parseAmazonUsSearchHtml(html: string): AmazonSearchCandidate[] {
  const candidates = new Map<string, AmazonSearchCandidate>();
  const cards = [
    ...html.matchAll(
      /<div\b(?=[^>]*\bdata-asin\s*=\s*"([A-Z0-9]{10})")(?=[^>]*\bdata-component-type\s*=\s*"s-search-result")[^>]*>/gi,
    ),
  ];

  for (const [index, match] of cards.entries()) {
    const openingTag = match[0];
    const asin = match[1];
    if (!asin || /\bAdHolder\b/i.test(openingTag)) continue;

    // Amazon search cards may include source script blocks, so a nested-DIV
    // parser would be brittle. A card is instead bounded by the next card
    // marker emitted by Amazon's own result list.
    const cardStart = (match.index ?? 0) + openingTag.length;
    const cardEnd = cards[index + 1]?.index ?? html.length;
    const card = html.slice(cardStart, cardEnd);

    const categories = uniqueTextMatches(card, /\bdata-category\s*=\s*"([^"]+)"/gi);
    if (categories.length !== 1 || !categories[0]) continue;

    const candidate = { asin, category: categories[0] };
    const existing = candidates.get(asin);
    if (existing && existing.category !== candidate.category) {
      candidates.delete(asin);
      continue;
    }
    candidates.set(asin, candidate);
  }

  if (!candidates.size) {
    throw new Error('No structurally valid Amazon USA search cards were found.');
  }
  return [...candidates.values()];
}

/**
 * A detail result is accepted only for an unambiguous public buy-box sold by
 * Amazon.com itself. A third-party or unresolved seller returns null rather
 * than being mislabeled as Amazon for the future TAX authority.
 */
export function parseAmazonUsDetailHtml(
  html: string,
  candidate: AmazonSearchCandidate,
): ImportProviderProduct | null {
  const sourceName = extractProductTitle(html);
  const priceScope =
    extractFeatureScope(html, 'corePriceDisplay_desktop_feature_div') ??
    extractFeatureScope(html, 'corePriceDisplay_mobile_feature_div');
  const sellerScope = extractFeatureScope(html, 'merchantInfoFeature_feature_div');
  const priceUsd = priceScope ? parseUnconditionalUsdPrice(priceScope) : null;
  const seller = sellerScope ? extractBuyBoxSeller(sellerScope) : null;

  if (!sourceName || !priceUsd || seller !== 'Amazon.com') return null;

  return {
    id: `amazon-us:${candidate.asin}`,
    externalId: candidate.asin,
    name: sourceName,
    store: 'Amazon USA',
    retailer: 'Amazon',
    category: candidate.category,
    priceUsd,
    productUrl: new URL(`/dp/${candidate.asin}`, AMAZON_US_BASE_URL).toString(),
    origin: 'US',
  };
}

function parseUnconditionalUsdPrice(value: string): number | null {
  const normalized = textFromHtml(value);
  if (
    /\b(coupon|subscribe|trade-?in|prime\s+(?:exclusive|member)|member\s+price|with\s+deal)\b/i.test(
      normalized,
    )
  ) {
    return null;
  }

  const pricePattern =
    /<[a-z][a-z0-9-]*\b(?=[^>]*\bclass\s*=\s*"[^"]*\bpriceToPay\b[^"]*")[^>]*>[\s\S]*?<span\b(?=[^>]*\bclass\s*=\s*"[^"]*\ba-price-symbol\b[^"]*")[^>]*>\s*\$\s*<\/span>\s*<span\b(?=[^>]*\bclass\s*=\s*"[^"]*\ba-price-whole\b[^"]*")[^>]*>\s*([\d,]+)(?:\s*<span\b(?=[^>]*\bclass\s*=\s*"[^"]*\ba-price-decimal\b[^"]*")[^>]*>\s*\.\s*<\/span>)?\s*<\/span>\s*<span\b(?=[^>]*\bclass\s*=\s*"[^"]*\ba-price-fraction\b[^"]*")[^>]*>\s*(\d{2})\s*<\/span>/gi;
  const prices = [
    ...new Set(
      [...value.matchAll(pricePattern)].map((match) => `${match[1] ?? ''}.${match[2] ?? ''}`),
    ),
  ].filter((price) => /^\d[\d,]*\.\d{2}$/.test(price));
  if (prices.length !== 1 || !prices[0]) return null;

  const priceUsd = Number(prices[0].replace(/,/g, ''));
  return Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null;
}

function extractBuyBoxSeller(value: string): string | null {
  const matches = [
    ...value.matchAll(
      /<div\b(?=[^>]*\boffer-display-attribute-name\s*=\s*"mobile-merchant-info")[^>]*>[\s\S]*?<span\b(?=[^>]*\boffer-display-feature-text-message\b)[^>]*>\s*([^<]+?)\s*<\/span>/gi,
    ),
  ]
    .map((match) => cleanSourceText(match[1]))
    .filter((seller): seller is string => seller !== null);

  const uniqueSellers = [...new Set(matches)];
  return uniqueSellers.length === 1 ? (uniqueSellers[0] ?? null) : null;
}

function extractProductTitle(html: string): string | null {
  const elementTitle = /<span\b(?=[^>]*\bid\s*=\s*"productTitle")[^>]*>([\s\S]*?)<\/span>/i.exec(
    html,
  );
  if (elementTitle?.[1]) return cleanSourceText(textFromHtml(elementTitle[1]));

  // Amazon's responsive rendering can omit #productTitle. Its source-owned
  // document-title meta field remains directly associated with the ASIN page.
  const metaTitle =
    /<meta\b(?=[^>]*\bname\s*=\s*"title")(?=[^>]*\bcontent\s*=\s*"([^"]+)")[^>]*>/i.exec(html);
  return metaTitle?.[1] ? cleanSourceText(textFromHtml(metaTitle[1])) : null;
}

function extractFeatureScope(html: string, id: string): string | null {
  const openingPattern = new RegExp(
    `<div\\b(?=[^>]*\\bid\\s*=\\s*"${escapeRegExp(id)}")[^>]*>`,
    'i',
  );
  const opening = openingPattern.exec(html);
  if (!opening || opening.index === undefined) return null;

  const contentStart = opening.index + opening[0].length;
  const nextFeature = /\bid\s*=\s*"[^"]+_feature_div"/gi;
  nextFeature.lastIndex = contentStart;
  const boundary = nextFeature.exec(html);
  return html.slice(contentStart, boundary?.index ?? html.length);
}

function uniqueTextMatches(value: string, pattern: RegExp): string[] {
  const matches = [...value.matchAll(pattern)]
    .map((match) => cleanSourceText(match[1]))
    .filter((match): match is string => match !== null);
  return [...new Set(matches)];
}

function textFromHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSourceText(value: string | undefined): string | null {
  const normalized = textFromHtml(value ?? '');
  return normalized || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
