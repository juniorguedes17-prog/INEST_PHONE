import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '../types/pricing';
import { applyOfferDraftPrice } from './offer-draft-price';

function createDraft(salePrice: number): OfferDraft {
  return {
    targetModule: 'offers',
    route: '/offers',
    source: 'pricing',
    payload: {
      productId: 'product-1',
      productName: 'Produto',
      color: 'Preto',
      capacity: '256GB',
      salePrice,
      offerPrice: salePrice + 100,
      deliveryTime: '',
      warranty: 'Garantia',
    },
  };
}

test('applies the configured increment only when the toggle is enabled', () => {
  const draft = createDraft(4349);

  assert.equal(applyOfferDraftPrice(draft, true, 100).payload.offerPrice, 4449);
  assert.equal(applyOfferDraftPrice(draft, false, 100).payload.offerPrice, 4349);
  assert.equal(draft.payload.salePrice, 4349);
  assert.equal(draft.payload.offerPrice, 4449);
});

test('preserves configured values without a new commercial rounding', () => {
  assert.equal(applyOfferDraftPrice(createDraft(4349), true, 150).payload.offerPrice, 4499);
  assert.equal(applyOfferDraftPrice(createDraft(4349), true, 0).payload.offerPrice, 4349);
});
