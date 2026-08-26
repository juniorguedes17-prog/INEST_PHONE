import { OfferDraft } from '@/features/pricing/types/pricing';
import { CommercialTemplate, OfferItem } from '../types/offers';
import { formatColorLabel } from './color-label';

export interface TemporaryOfferItem extends Omit<OfferItem, 'createdAt'> {
  createdAt?: string;
  template: CommercialTemplate;
  sourceDrafts: OfferDraft[];
}

export interface PreparedTemporaryOffer extends TemporaryOfferItem {
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
    createdAt: draft.createdAt,
    sourceDrafts: [draft],
    sourceDraft: draft,
  };
}

export function prepareConsolidatedTemporaryOffers(
  offers: PreparedTemporaryOffer[],
): TemporaryOfferItem[] {
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

function consolidateTemplateGroup(group: PreparedTemporaryOffer[]): TemporaryOfferItem | null {
  const firstOffer = group[0];
  if (!firstOffer) return null;
  if (group.length === 1) return firstOffer;

  const sections = splitTemplateForProducts(firstOffer.template.content);
  if (!sections) return null;

  const message = renderConsolidatedMessage(firstOffer.template.content, group);

  return {
    ...firstOffer,
    sourceDrafts: group.flatMap((offer) => offer.sourceDrafts),
    message,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(message)}`,
  };
}

export function renderTemporaryOfferMessage(offer: TemporaryOfferItem, deliveryTime: string) {
  if (offer.sourceDrafts.length === 1) {
    const [draft] = offer.sourceDrafts;
    if (!draft) return offer.message;
    return renderOfferMessage(offer.template.content, toTemplateVariables(draft, deliveryTime));
  }

  const preparedOffers = offer.sourceDrafts.map((draft) => ({
    ...offer,
    id: draft.payload.productId ?? draft.payload.sourceQuoteId ?? offer.id,
    sourceDrafts: [draft],
    sourceDraft: draft,
  }));
  return renderConsolidatedMessage(offer.template.content, preparedOffers, deliveryTime);
}

function renderConsolidatedMessage(
  template: string,
  group: PreparedTemporaryOffer[],
  deliveryTime?: string,
) {
  const firstOffer = group[0];
  if (!firstOffer) return '';

  const sections = splitTemplateForProducts(template);
  if (!sections) return firstOffer.message;

  const header = renderTemplate(
    sections.header,
    toConsolidatedTemplateVariables(firstOffer.sourceDraft, deliveryTime),
  );
  const products = groupOffersByConfiguration(group).map((productGroup) =>
    renderProductConfiguration(sections.productHeading, productGroup, deliveryTime),
  );
  const footer = renderTemplate(
    sections.footer,
    toConsolidatedTemplateVariables(firstOffer.sourceDraft, deliveryTime),
  );
  return normalizeMessageSpacing([header, ...products, footer].filter(Boolean).join('\n\n'));
}

function groupOffersByConfiguration(offers: PreparedTemporaryOffer[]) {
  const groups = new Map<string, PreparedTemporaryOffer[]>();

  offers.forEach((offer, index) => {
    const configurationKey = getProductConfigurationKey(offer);
    const groupKey = configurationKey ?? `unverified-${index}`;
    const group = groups.get(groupKey);
    if (group) group.push(offer);
    else groups.set(groupKey, [offer]);
  });

  return Array.from(groups.values());
}

function getProductConfigurationKey(offer: PreparedTemporaryOffer) {
  const { productType, payload } = offer.sourceDraft;
  if (productType === 'IPHONE_USED' || productType === 'APPLE_CPO') return null;

  return JSON.stringify({
    productId: payload.productId,
    productName: payload.productName,
    capacity: payload.capacity,
    productType: productType ?? null,
  });
}

function renderProductConfiguration(
  productHeadingTemplate: string,
  offers: PreparedTemporaryOffer[],
  deliveryTime?: string,
) {
  const firstOffer = offers[0];
  if (!firstOffer) return '';

  const heading = renderTemplate(
    productHeadingTemplate,
    toProductHeadingVariables(firstOffer.sourceDraft, deliveryTime),
  );
  const variants = offers.map((offer) => formatVariantLine(offer.sourceDraft)).filter(Boolean);

  return normalizeMessageSpacing([heading, ...variants].filter(Boolean).join('\n'));
}

function formatVariantLine(draft: OfferDraft) {
  const color = formatColorLabel(draft.payload.color);
  const price = formatCurrency(draft.payload.offerPrice);
  return color ? `${color}: ${price}` : `💰 ${price}`;
}

function splitTemplateForProducts(template: string) {
  const productMarkerIndex = findFirstMarkerIndex(template, ['{{produto}}', '{{modelo}}']);
  if (productMarkerIndex === -1) return null;

  const firstProductDetailMarkerIndex = findFirstMarkerIndexAfter(
    template,
    ['{{cor}}', '{{cores}}', '{{capacidade}}', '{{preco_oferta}}', '{{preco}}'],
    productMarkerIndex,
  );
  const lastProductDetailMarkerIndex = findLastMarkerIndex(
    template,
    ['{{cor}}', '{{cores}}', '{{capacidade}}', '{{preco_oferta}}', '{{preco}}'],
    productMarkerIndex,
  );

  const productStart = template.lastIndexOf('\n', productMarkerIndex) + 1;
  const productHeadingEnd =
    firstProductDetailMarkerIndex === -1
      ? template.indexOf('\n', productMarkerIndex)
      : template.lastIndexOf('\n', firstProductDetailMarkerIndex) + 1;
  const productEndLine = template.indexOf('\n', lastProductDetailMarkerIndex);
  const productEnd = productEndLine === -1 ? template.length : productEndLine;

  return {
    header: template.slice(0, productStart).trimEnd(),
    productHeading: template.slice(productStart, productHeadingEnd).trim(),
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

function findFirstMarkerIndexAfter(template: string, markers: string[], fromIndex: number) {
  return markers.reduce((firstIndex, marker) => {
    const markerIndex = template.indexOf(marker, fromIndex);
    if (markerIndex === -1) return firstIndex;
    return firstIndex === -1 ? markerIndex : Math.min(firstIndex, markerIndex);
  }, -1);
}

function toTemplateVariables(draft: OfferDraft, deliveryTime?: string): Record<string, string> {
  const payload = draft.payload;
  const capacity = getUnrepresentedCapacity(payload.productName, payload.capacity);
  return {
    produto: payload.productName,
    modelo: payload.productName,
    cor: payload.color,
    capacidade: capacity,
    preco: formatCurrency(payload.salePrice),
    preco_oferta: formatCurrency(payload.offerPrice),
    prazo: deliveryTime || payload.deliveryTime || 'Prazo conforme oferta',
    garantia: payload.warranty,
  };
}

function toConsolidatedTemplateVariables(
  draft: OfferDraft,
  deliveryTime?: string,
): Record<string, string> {
  const payload = draft.payload;
  const capacity = getUnrepresentedCapacity(payload.productName, payload.capacity);
  return {
    ...toTemplateVariables(draft, deliveryTime),
    cores: [payload.color, capacity].filter(Boolean).join(' '),
  };
}

function toProductHeadingVariables(
  draft: OfferDraft,
  deliveryTime?: string,
): Record<string, string> {
  const payload = draft.payload;
  const productName = payload.productName.trim();
  const capacity = getUnrepresentedCapacity(productName, payload.capacity);
  const productLabel =
    capacity &&
    !productName.toLocaleLowerCase('pt-BR').includes(capacity.toLocaleLowerCase('pt-BR'))
      ? `${productName} ${capacity}`
      : productName;

  return {
    ...toConsolidatedTemplateVariables(draft, deliveryTime),
    produto: productLabel,
    modelo: productLabel,
  };
}

function getUnrepresentedCapacity(productName: string, capacity: string) {
  const trimmedCapacity = capacity.trim();
  if (!trimmedCapacity) return '';

  const normalizedName = normalizeStorageForComparison(productName);
  const normalizedCapacity = normalizeStorageForComparison(trimmedCapacity);
  return normalizedName.includes(normalizedCapacity) ? '' : trimmedCapacity;
}

function normalizeStorageForComparison(value: string) {
  return value.toLocaleLowerCase('pt-BR').replace(/[\s-]+/g, '');
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
    templates.find(
      (template) => template.productType === (usedProduct ? 'IPHONE_USED' : 'IPHONE_SEALED'),
    ) ?? templates[0]
  );
}
