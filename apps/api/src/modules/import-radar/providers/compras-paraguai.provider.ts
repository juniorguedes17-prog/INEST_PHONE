import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ImportSearchQueryDto } from '../dto/import-radar.dto';
import { ImportProvider, ImportProviderProduct } from '../interfaces/import-provider.interface';

const BASE_URL = 'https://www.comprasparaguai.com.br';
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_DETAIL_REQUESTS = 12;

interface CacheEntry {
  expiresAt: number;
  products: ImportProviderProduct[];
}

interface ParsedOffer {
  store: string;
  storeUrl?: string;
  city?: string;
  priceUsd: number;
  availability?: string;
}

@Injectable()
export class ComprasParaguaiProvider implements ImportProvider {
  readonly name = 'compras_paraguai';
  private readonly logger = new Logger(ComprasParaguaiProvider.name);
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: ImportSearchQueryDto): Promise<ImportProviderProduct[]> {
    const search = query.search?.trim() ?? '';
    if (search.length < 2) {
      return [];
    }

    const cacheKey = normalizeText(`${search}|${query.category ?? ''}`);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.products;
    }

    const searchUrl = new URL('/busca/', BASE_URL);
    searchUrl.searchParams.set('q', search);
    const html = await this.fetchPublicHtml(searchUrl.toString());
    let products = parseSearchResults(html, new Date().toISOString());

    if (query.category) {
      const category = normalizeText(query.category);
      products = products.filter((product) => normalizeText(product.category) === category);
    }

    const enriched = await mapWithConcurrency(
      products.slice(0, MAX_DETAIL_REQUESTS),
      3,
      async (product) => this.enrichWithPublicOffers(product),
    );

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      products: enriched,
    });
    return enriched;
  }

  private async enrichWithPublicOffers(
    product: ImportProviderProduct,
  ): Promise<ImportProviderProduct> {
    try {
      const html = await this.fetchPublicHtml(product.productUrl);
      const offers = parseProductOffers(html);
      if (!offers.length) {
        return product;
      }

      const ordered = [...offers].sort((a, b) => a.priceUsd - b.priceUsd);
      const cheapest = ordered[0];
      const mostExpensive = ordered[ordered.length - 1];
      if (!cheapest || !mostExpensive) {
        return product;
      }
      const prices = ordered.map((offer) => offer.priceUsd);
      const stores = new Set(ordered.map((offer) => normalizeText(offer.store)).filter(Boolean));

      return {
        ...product,
        store: cheapest.store,
        storeUrl: cheapest.storeUrl,
        city: cheapest.city,
        availability: cheapest.availability,
        priceUsd: cheapest.priceUsd,
        minimumPriceUsd: cheapest.priceUsd,
        averagePriceUsd: roundMoney(prices.reduce((total, price) => total + price, 0) / prices.length),
        maximumPriceUsd: mostExpensive.priceUsd,
        storeCount: stores.size || product.storeCount,
        offerCount: offers.length,
      };
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel detalhar o produto externo ${product.externalId ?? product.id}: ${getErrorMessage(error)}`,
      );
      return product;
    }
  }

  private async fetchPublicHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'User-Agent': 'iNestPhone-PriceRadar/1.0 (+public-price-consultation)',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      this.logger.error(`Falha ao consultar pagina publica do Compras Paraguai: ${getErrorMessage(error)}`);
      throw new ServiceUnavailableException(
        'O Compras Paraguai esta indisponivel no momento. Tente novamente em alguns minutos.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function parseSearchResults(html: string, consultedAt: string): ImportProviderProduct[] {
  const products: ImportProviderProduct[] = [];

  for (const card of extractElementsByClass(html, 'promocao-produtos-item')) {
    const cardHtml = card.full;
    const link =
      findElementByClass(cardHtml, 'promocao-item-nome', 'a') ??
      findElementByClass(cardHtml, 'truncate', 'a') ??
      findAnchor(cardHtml, (href) => href.includes('_'));
    const href = link ? extractAttribute(link.openingTag, 'href') : undefined;
    const name = cleanText(
      link?.content ??
        findElementByClass(cardHtml, 'promocao-item-nome')?.content ??
        findElementByClass(cardHtml, 'truncate')?.content ??
        '',
    );
    const priceModel = findElementByClass(cardHtml, 'price-model')?.content ?? '';
    const priceUsd = parseLocalizedMoney(stripHtml(priceModel));
    if (!href || !name || !priceUsd) {
      continue;
    }

    const productUrl = new URL(href, BASE_URL).toString();
    const externalId = extractExternalId(productUrl);
    const offerCount = parseInteger(
      stripHtml(findElementByClass(cardHtml, 'ver-detalhes')?.content ?? ''),
    );
    const attributes = inferProductAttributes(name);
    const image =
      findFirstTag(cardHtml, 'img', (tag) => hasClass(tag, 'lozad')) ??
      findFirstTag(cardHtml, 'img');

    products.push({
      id: externalId ? `py-${externalId}` : `py-${slugify(productUrl)}`,
      externalId,
      name,
      store: '',
      category: attributes.category,
      brand: attributes.brand,
      model: attributes.model,
      capacity: attributes.capacity,
      color: attributes.color,
      priceUsd,
      minimumPriceUsd: priceUsd,
      priceBrlSource: parseLocalizedMoney(
        stripHtml(findElementByClass(cardHtml, 'promocao-item-preco-text')?.content ?? ''),
      ),
      productUrl,
      imageUrl: image
        ? extractAttribute(image, 'src') ?? extractAttribute(image, 'data-src')
        : undefined,
      consultedAt,
      origin: 'PY',
      offerCount,
      storeCount: offerCount,
    });
  }

  return uniqueBy(products, (product) => product.id);
}

export function parseProductOffers(html: string): ParsedOffer[] {
  const offers: ParsedOffer[] = [];
  const cards = [
    ...extractElementsByClass(html, 'promocao-produtos-item'),
    ...extractElementsByClass(html, 'promocao-item-lojas'),
  ];

  for (const card of cards) {
    const cardHtml = card.full;
    const text = cleanText(stripHtml(cardHtml));
    const priceText = stripHtml(
      findElementByClass(cardHtml, 'price-model')?.content ??
        findElementByClass(cardHtml, 'promocao-item-preco')?.content ??
        text,
    );
    const priceUsd = parseUsdFromText(priceText);
    if (!priceUsd) {
      continue;
    }

    const storeElement =
      findElementByClass(cardHtml, 'promocao-item-loja', 'a') ??
      findElementByClass(cardHtml, 'loja-nome', 'a') ??
      findAnchor(cardHtml, (href) => href.includes('loja')) ??
      findElementByClass(cardHtml, 'promocao-item-loja') ??
      findElementByClass(cardHtml, 'loja-nome');
    const store = cleanText(storeElement?.content ?? '');
    if (!store) {
      continue;
    }

    const href = extractAttribute(storeElement?.openingTag ?? '', 'href');
    offers.push({
      store,
      storeUrl: href ? new URL(href, BASE_URL).toString() : undefined,
      city: extractCity(text),
      priceUsd,
      availability: extractAvailability(text),
    });
  }

  return uniqueBy(offers, (offer) => `${normalizeText(offer.store)}|${offer.priceUsd}`);
}

interface HtmlElement {
  openingTag: string;
  content: string;
  full: string;
}

function extractElementsByClass(html: string, className: string): HtmlElement[] {
  const elements: HtmlElement[] = [];
  const openingPattern = /<([a-z][\w:-]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = openingPattern.exec(html))) {
    const openingTag = match[0];
    const tagName = match[1];
    if (!openingTag || !tagName || !hasClass(openingTag, className)) continue;
    const element = extractElementAt(html, match.index, tagName, openingTag);
    if (element) elements.push(element);
  }

  return uniqueBy(elements, (element) => `${element.openingTag}|${element.content}`);
}

function findElementByClass(
  html: string,
  className: string,
  tagName?: string,
): HtmlElement | undefined {
  return extractElementsByClass(html, className).find((element) =>
    tagName ? element.openingTag.toLowerCase().startsWith(`<${tagName.toLowerCase()}`) : true,
  );
}

function findAnchor(
  html: string,
  predicate: (href: string) => boolean,
): HtmlElement | undefined {
  const pattern = /<a\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const openingTag = match[0];
    if (!openingTag) continue;
    const href = extractAttribute(openingTag, 'href');
    if (!href || !predicate(href)) continue;
    const element = extractElementAt(html, match.index, 'a', openingTag);
    if (element) return element;
  }
  return undefined;
}

function findFirstTag(
  html: string,
  tagName: string,
  predicate: (tag: string) => boolean = () => true,
): string | undefined {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const tag = match[0];
    if (tag && predicate(tag)) return tag;
  }
  return undefined;
}

function extractElementAt(
  html: string,
  start: number,
  tagName: string,
  openingTag: string,
): HtmlElement | undefined {
  if (openingTag.endsWith('/>')) {
    return { openingTag, content: '', full: openingTag };
  }

  const tokenPattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi');
  tokenPattern.lastIndex = start + openingTag.length;
  let depth = 1;
  let token: RegExpExecArray | null;
  while ((token = tokenPattern.exec(html))) {
    const tokenValue = token[0];
    if (!tokenValue) continue;
    if (tokenValue.startsWith('</')) depth -= 1;
    else if (!tokenValue.endsWith('/>')) depth += 1;
    if (depth !== 0) continue;

    return {
      openingTag,
      content: html.slice(start + openingTag.length, token.index),
      full: html.slice(start, tokenPattern.lastIndex),
    };
  }
  return undefined;
}

function hasClass(tag: string, className: string): boolean {
  const classValue = extractAttribute(tag, 'class') ?? '';
  return classValue.split(/\s+/).includes(className);
}

function extractAttribute(tag: string, attribute: string): string | undefined {
  const pattern = new RegExp(`\\b${escapeRegExp(attribute)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = tag.match(pattern);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '') || undefined;
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_entity, code: string) => {
    if (code.startsWith('#x')) return decodeCodePoint(code.slice(2), 16, `&${code};`);
    if (code.startsWith('#')) return decodeCodePoint(code.slice(1), 10, `&${code};`);
    return named[code.toLowerCase()] ?? `&${code};`;
  });
}

function decodeCodePoint(value: string, radix: number, fallback: string): string {
  const codePoint = Number.parseInt(value, radix);
  return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inferProductAttributes(name: string) {
  const normalized = normalizeText(name);
  const category = normalized.includes('iphone')
    ? 'iPhone'
    : normalized.includes('macbook')
      ? 'MacBook'
      : normalized.includes('ipad')
        ? 'iPad'
        : normalized.includes('apple watch') || normalized.includes('smartwatch')
          ? 'Apple Watch'
          : normalized.includes('airpods') || normalized.includes('fone')
            ? 'AirPods'
            : 'Outros';
  const capacity = name.match(/\b(\d+(?:\.\d+)?)\s*(GB|TB)\b/i)?.[0]?.replace(/\s+/g, ' ');
  const model = name.match(/\b(iPhone\s+[\w\s-]+?|MacBook\s+(?:Air|Pro)(?:\s+\w+){0,3}|iPad(?:\s+\w+){0,3}|Apple\s+Watch(?:\s+\w+){0,3}|AirPods(?:\s+\w+){0,2})(?=\s+\d+\s*(?:GB|TB)|$)/i)?.[0]?.trim();
  const colors = ['preto', 'branco', 'azul', 'verde', 'rosa', 'roxo', 'natural', 'desert', 'dourado', 'prata', 'grafite'];
  const color = colors.find((candidate) => normalized.includes(candidate));

  return {
    category,
    brand: normalized.includes('apple') || ['iphone', 'macbook', 'ipad', 'airpods'].some((term) => normalized.includes(term)) ? 'Apple' : undefined,
    model,
    capacity,
    color: color ? color.charAt(0).toUpperCase() + color.slice(1) : undefined,
  };
}

function parseLocalizedMoney(value: string): number | undefined {
  const match = value.match(/([\d.]+(?:,\d{1,2})?)/);
  const amount = match?.[1];
  if (!amount) return undefined;
  const parsed = Number(amount.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseUsdFromText(value: string): number | undefined {
  const match = value.match(/(?:US\$|USD|U\$)\s*([\d.]+(?:,\d{1,2})?)/i);
  const amount = match?.[1];
  return amount ? parseLocalizedMoney(amount) : undefined;
}

function parseInteger(value: string): number | undefined {
  const parsed = Number(value.match(/\d+/)?.[0] ?? 0);
  return parsed || undefined;
}

function extractExternalId(value: string): string | undefined {
  return value.match(/_(\d+)\/?(?:\?|$)/)?.[1];
}

function extractCity(value: string): string | undefined {
  return ['Ciudad del Este', 'Salto del Guaira', 'Pedro Juan Caballero'].find((city) =>
    normalizeText(value).includes(normalizeText(city)),
  );
}

function extractAvailability(value: string): string | undefined {
  const normalized = normalizeText(value);
  if (normalized.includes('sem estoque') || normalized.includes('indisponivel')) return 'Indisponivel';
  if (normalized.includes('em estoque') || normalized.includes('disponivel')) return 'Disponivel';
  return undefined;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  return Array.from(new Map(items.map((item) => [key(item), item])).values());
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const queue = items.map((item, index) => ({ index, item }));
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) return;
      results[next.index] = await mapper(next.item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
