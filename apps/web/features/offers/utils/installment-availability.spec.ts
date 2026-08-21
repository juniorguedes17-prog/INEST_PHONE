import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '@/features/pricing/types/pricing';
import { OfferItem } from '../types/offers';
import { buildInstallmentAvailability } from './installment-availability';

function offer({
  id = 'offer-1',
  createdAt = '2026-08-21T12:00:00.000Z',
  color = 'Azul',
  offerPrice = 7099,
  salePrice = 6999,
}: {
  id?: string;
  createdAt?: string;
  color?: string;
  offerPrice?: number;
  salePrice?: number;
} = {}): OfferItem {
  return {
    id,
    template: undefined,
    message: 'Oferta',
    status: 'GENERATED',
    salePrice,
    offerPrice,
    whatsappUrl: 'https://wa.me/',
    productId: 'product-1',
    product: {
      id: 'product-1',
      name: 'iPhone 17 Pro Max 256GB',
      model: 'iPhone 17 Pro Max',
      color,
    },
    createdAt,
  };
}

function draft({
  createdAt,
  color = 'Azul',
  offerPrice = 7199,
  salePrice = 6999,
}: {
  createdAt?: string;
  color?: string;
  offerPrice?: number;
  salePrice?: number;
} = {}): OfferDraft {
  return {
    targetModule: 'offers',
    route: '/offers',
    createdAt,
    payload: {
      productId: 'product-1',
      sourceQuoteId: 'quote-1',
      productName: 'iPhone 17 Pro Max 256GB',
      color,
      capacity: '256GB',
      salePrice,
      offerPrice,
      deliveryTime: 'Entrega imediata',
      warranty: '12 meses',
    },
  };
}

function selectedColor(offers: OfferItem[], drafts: OfferDraft[], color = 'Azul') {
  const [product] = buildInstallmentAvailability(offers, drafts);
  assert.ok(product);
  const selected = product.colors.find((item) => item.label === color);
  assert.ok(selected);
  return selected;
}

test('uses persisted offers and current drafts as the only availability sources', () => {
  const selected = selectedColor([offer()], [draft({ color: 'Preto' })], 'Azul');
  const products = buildInstallmentAvailability([offer()], [draft({ color: 'Preto' })]);

  assert.equal(products.length, 1);
  assert.equal(products[0]?.colors.length, 2);
  assert.equal(selected.entry?.sourceType, 'offer');
});

test('uses offerPrice instead of salePrice', () => {
  const selected = selectedColor([offer({ offerPrice: 7299, salePrice: 6999 })], []);

  assert.equal(selected.entry?.offerPrice, 7299);
});

test('chooses the newer draft over an older persisted offer', () => {
  const selected = selectedColor(
    [offer({ createdAt: '2026-08-21T12:00:00.000Z', offerPrice: 7099 })],
    [draft({ createdAt: '2026-08-21T13:00:00.000Z', offerPrice: 7199 })],
  );

  assert.equal(selected.entry?.sourceType, 'draft');
  assert.equal(selected.entry?.offerPrice, 7199);
});

test('chooses the newer persisted offer over an older draft', () => {
  const selected = selectedColor(
    [offer({ createdAt: '2026-08-21T13:00:00.000Z', offerPrice: 7099 })],
    [draft({ createdAt: '2026-08-21T12:00:00.000Z', offerPrice: 7199 })],
  );

  assert.equal(selected.entry?.sourceType, 'offer');
  assert.equal(selected.entry?.offerPrice, 7099);
});

test('does not let a legacy draft without a timestamp win over a dated offer', () => {
  const selected = selectedColor([offer({ offerPrice: 7099 })], [draft({ offerPrice: 7199 })]);

  assert.equal(selected.entry?.sourceType, 'offer');
  assert.equal(selected.entry?.offerPrice, 7099);
});

test('keeps a single legacy draft available because no temporal choice is needed', () => {
  const selected = selectedColor([], [draft({ createdAt: undefined, offerPrice: 7199 })]);

  assert.equal(selected.entry?.sourceType, 'draft');
  assert.equal(selected.entry?.offerPrice, 7199);
});

test('does not resolve duplicated legacy occurrences without comparable timestamps', () => {
  const selected = selectedColor(
    [offer({ createdAt: '' })],
    [draft({ createdAt: undefined, offerPrice: 7199 })],
  );

  assert.equal(selected.entry, null);
  assert.equal(selected.isAmbiguous, true);
});
