import { OfferDraft } from '@/features/pricing/types/pricing';
import { OfferItem } from '../types/offers';
import { formatColorLabel } from './color-label';

export type InstallmentAvailabilitySource = 'offer' | 'draft';

export interface InstallmentAvailabilityEntry {
  sourceId: string;
  sourceType: InstallmentAvailabilitySource;
  productId: string | null;
  productKey: string;
  productName: string;
  colorKey: string;
  color: string;
  offerPrice: number;
  createdAt?: string;
}

export interface InstallmentAvailabilityColor {
  key: string;
  label: string;
  entry: InstallmentAvailabilityEntry | null;
  isAmbiguous: boolean;
}

export interface InstallmentAvailabilityProduct {
  key: string;
  name: string;
  colors: InstallmentAvailabilityColor[];
}

export function buildInstallmentAvailability(
  offers: OfferItem[],
  drafts: OfferDraft[],
): InstallmentAvailabilityProduct[] {
  const entries = [...offers.map(toOfferEntry), ...drafts.map(toDraftEntry)].filter(
    (entry): entry is InstallmentAvailabilityEntry => entry !== null,
  );
  const products = new Map<
    string,
    { name: string; colors: Map<string, InstallmentAvailabilityEntry[]> }
  >();

  for (const entry of entries) {
    const product = products.get(entry.productKey) ?? {
      name: entry.productName,
      colors: new Map(),
    };
    const colors = product.colors.get(entry.colorKey) ?? [];
    colors.push(entry);
    product.colors.set(entry.colorKey, colors);
    products.set(entry.productKey, product);
  }

  return Array.from(products.entries())
    .map(([key, product]) => ({
      key,
      name: product.name,
      colors: Array.from(product.colors.entries())
        .map(([colorKey, entriesForColor]) => {
          const first = entriesForColor[0]!;
          const resolved = resolveMostRecent(entriesForColor);

          return {
            key: colorKey,
            label: formatColorLabel(first.color) || 'Sem cor informada',
            entry: resolved,
            isAmbiguous: resolved === null && entriesForColor.length > 1,
          };
        })
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function toOfferEntry(offer: OfferItem): InstallmentAvailabilityEntry | null {
  const productName = offer.product?.name.trim() ?? '';
  if (!productName || !isUsablePrice(offer.offerPrice)) return null;

  return {
    sourceId: offer.id,
    sourceType: 'offer',
    productId: offer.productId ?? offer.product?.id ?? null,
    productKey: productKey(offer.productId ?? offer.product?.id ?? null, productName),
    productName,
    colorKey: colorKey(offer.product?.color ?? ''),
    color: offer.product?.color?.trim() ?? '',
    offerPrice: offer.offerPrice,
    createdAt: offer.createdAt,
  };
}

function toDraftEntry(draft: OfferDraft): InstallmentAvailabilityEntry | null {
  const productName = draft.payload.productName.trim();
  if (!productName || !isUsablePrice(draft.payload.offerPrice)) return null;

  return {
    sourceId: draft.payload.sourceQuoteId ?? draft.payload.productId ?? productName,
    sourceType: 'draft',
    productId: draft.payload.productId,
    productKey: productKey(draft.payload.productId, productName),
    productName,
    colorKey: colorKey(draft.payload.color),
    color: draft.payload.color.trim(),
    offerPrice: draft.payload.offerPrice,
    createdAt: draft.createdAt,
  };
}

function productKey(productId: string | null | undefined, productName: string) {
  return productId ? `product:${productId}` : `name:${normalizeExact(productName)}`;
}

function colorKey(color: string) {
  return color.trim() ? `color:${normalizeExact(color)}` : 'color:unknown';
}

function normalizeExact(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function isUsablePrice(value: number) {
  return Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 100));
}

function resolveMostRecent(entries: InstallmentAvailabilityEntry[]) {
  if (entries.length === 1) return entries[0]!;

  const datedEntries = entries
    .map((entry) => ({ entry, timestamp: timestamp(entry.createdAt) }))
    .filter(
      (item): item is { entry: InstallmentAvailabilityEntry; timestamp: number } =>
        item.timestamp !== null,
    );

  if (!datedEntries.length) return null;

  const latestTimestamp = Math.max(...datedEntries.map((item) => item.timestamp));
  const latestEntries = datedEntries.filter((item) => item.timestamp === latestTimestamp);

  return latestEntries.length === 1 ? latestEntries[0]!.entry : null;
}

function timestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}
