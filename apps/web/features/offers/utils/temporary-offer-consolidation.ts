import { OfferDraft } from '@/features/pricing/types/pricing';
import { CommercialTemplate, OfferItem } from '../types/offers';

export interface PreparedTemporaryOffer extends OfferItem {
  template: CommercialTemplate;
  sourceDraft: OfferDraft;
}

export function prepareTemporaryOffer(
  draft: OfferDraft,
  templates: CommercialTemplate[],
): PreparedTemporaryOffer | null {
  const template = findTemplateForProductType(templates, draft.productType);
  if (!template) return null;

  const payload = draft.payload;
  const draftIdentity = payload.productId ?? payload.sourceQuoteId;
  if (!draftIdentity) return null;

  const message = renderOfferMessage(template.content, toTemplateVariables(draft));

  return {
    id: draftIdentity,
    template,
    message,
    status: 'DRAFT',
    salePrice: payload.salePrice,
    offerPrice: payload.offerPrice,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
    productId: payload.productId,
    createdAt: new Date().toISOString(),
    sourceDraft: draft,
  };
}

export function prepareConsolidatedTemporaryOffers(
  offers: PreparedTemporaryOffer[],
): OfferItem[] {
  const groups = new Map<string, PreparedTemporaryOffer[]>();

  for (const offer of offers) {
    const group = groups.get(offer.template.id);
    if (group) group.push(offer);
    else groups.set(offer.template.id, [offer]);
  }

  return Array.from(groups.values()).flatMap((group) => {
    const consolidated = consolidateTemplateGroup(group);
    return consolidated ? [consolidated] : group;
  });
}

function consolidateTemplateGroup(group: PreparedTemporaryOffer[]): OfferItem | null {
  const firstOffer = group[0];
  if (!firstOffer) return null;
  if (group.length === 1) return firstOffer;

  const sections = splitTemplateForProducts(firstOffer.template.content);
  if (!sections) return null;

  const header = renderTemplate(sections.header, toConsolidatedTemplateVariables(firstOffer.sourceDraft));
  const products = group.map((offer) =>
    renderOfferMessage(sections.product, toConsolidatedTemplateVariables(offer.sourceDraft)),
  );
  const footer = renderTemplate(sections.footer, toConsolidatedTemplateVariables(firstOffer.sourceDraft));
  const message = normalizeMessageSpacing([header, ...products, footer].filter(Boolean).join('\n\n'));

  return {
    ...firstOffer,
    message,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
  };
}

function splitTemplateForProducts(template: string) {
  const productMarkerIndex = findFirstMarkerIndex(template, ['{{produto}}', '{{modelo}}']);
  if (productMarkerIndex === -1) return null;

  const productDetailMarkerIndex = findLastMarkerIndex(
    template,
    ['{{cor}}', '{{cores}}', '{{capacidade}}', '{{preco_oferta}}', '{{preco}}'],
    productMarkerIndex,
  );

  const productStart = template.lastIndexOf('\n', productMarkerIndex) + 1;
  const productEndLine = template.indexOf('\n', productDetailMarkerIndex);
  const productEnd = productEndLine === -1 ? template.length : productEndLine;

  return {
    header: template.slice(0, productStart).trimEnd(),
    product: template.slice(productStart, productEnd).trim(),
    footer: template.slice(productEnd).trimStart(),
  };
}

function findFirstMarkerIndex(template: string, markers: string[]) {
  return markers.reduce((firstIndex, marker) => {
    const markerIndex = template.indexOf(marker);
    if (markerIndex === -1) return firstIndex;
    return firstIndex === -1 ? markerIndex : Math.min(firstIndex, markerIndex);
  }, -1);
}

function findLastMarkerIndex(template: string, markers: string[], fromIndex: number) {
  return markers.reduce((lastIndex, marker) => {
    const markerIndex = template.lastIndexOf(marker);
    return markerIndex >= fromIndex ? Math.max(lastIndex, markerIndex) : lastIndex;
  }, fromIndex);
}

function toTemplateVariables(draft: OfferDraft): Record<string, string> {
  const payload = draft.payload;
  return {
    produto: payload.productName,
    modelo: payload.productName,
    cor: payload.color,
    capacidade: payload.capacity,
    preco: formatCurrency(payload.salePrice),
    preco_oferta: formatCurrency(payload.offerPrice),
    prazo: payload.deliveryTime || 'Prazo conforme oferta',
    garantia: payload.warranty,
  };
}

function toConsolidatedTemplateVariables(draft: OfferDraft): Record<string, string> {
  const payload = draft.payload;
  return {
    ...toTemplateVariables(draft),
    cores: [payload.color, payload.capacity].filter(Boolean).join(' '),
  };
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => variables[key] ?? '');
}

function renderOfferMessage(template: string, variables: Record<string, string>) {
  const offerPrice = variables.preco_oferta ?? '';
  const productName = variables.produto ?? variables.modelo ?? '';
  const renderedMessage = removeLegacyOfferPrice(renderTemplate(template, variables));

  if (hasOfferPriceByVariation(renderedMessage, offerPrice)) {
    return normalizeMessageSpacing(renderedMessage);
  }

  const messageWithoutStandalonePrice = removeStandaloneOfferPrice(renderedMessage, offerPrice);
  return insertOfferPriceBelowProduct(messageWithoutStandalonePrice, productName, offerPrice);
}

function removeLegacyOfferPrice(message: string) {
  return message
    .split('\n')
    .filter((line) => !/^\s*pre[cç]o\s+de\s+oferta\s*:/i.test(line))
    .join('\n');
}

function hasOfferPriceByVariation(message: string, offerPrice: string) {
  return message
    .split('\n')
    .some((line) => line.includes(offerPrice) && !isStandaloneOfferPrice(line, offerPrice));
}

function removeStandaloneOfferPrice(message: string, offerPrice: string) {
  return message
    .split('\n')
    .filter((line) => !isStandaloneOfferPrice(line, offerPrice))
    .join('\n');
}

function isStandaloneOfferPrice(line: string, offerPrice: string) {
  return line.trim() === `💰 ${offerPrice}`;
}

function insertOfferPriceBelowProduct(message: string, productName: string, offerPrice: string) {
  const lines = message.split('\n');
  const normalizedProductName = normalizeForMatch(productName);
  const productLineIndex = lines.findIndex((line) =>
    normalizeForMatch(line).includes(normalizedProductName),
  );

  if (productLineIndex === -1) return normalizeMessageSpacing(message);

  lines.splice(productLineIndex + 1, 0, '', `💰 ${offerPrice}`);
  return normalizeMessageSpacing(lines.join('\n'));
}

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMessageSpacing(message: string) {
  return message.replace(/\n{3,}/g, '\n\n').trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function findTemplateForProductType(templates: CommercialTemplate[], productType?: string) {
  const usedProduct = productType === 'IPHONE_USED' || productType === 'APPLE_CPO';
  return (
    templates.find((template) => template.productType === (usedProduct ? 'IPHONE_USED' : 'IPHONE_SEALED')) ??
    templates[0]
  );
}
