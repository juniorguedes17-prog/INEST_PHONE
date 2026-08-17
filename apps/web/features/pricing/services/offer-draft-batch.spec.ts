import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '../types/pricing';
import { prepareOfferDraftBatch } from './offer-draft-batch';
import { applyOfferDraftPrice } from './offer-draft-price';

type Target = { id: string; supplier: string; color: string; condition: string };

function draftFor(target: Target): OfferDraft {
  return {
    targetModule: 'offers',
    route: '/offers',
    source: 'pricing',
    payload: {
      productId: target.id,
      productName: `Produto ${target.condition} ${target.supplier}`,
      color: target.color,
      capacity: '256GB',
      salePrice: 6500,
      offerPrice: 6400,
      deliveryTime: 'Imediata',
      warranty: '12 meses',
    },
  };
}

for (const count of [1, 2, 5, 10]) {
  test(`prepares ${count} selected drafts once each`, async () => {
    const targets = Array.from({ length: count }, (_, index) => ({
      id: `product-${index + 1}`,
      supplier: index % 2 ? 'Fornecedor B' : 'Fornecedor A',
      color: index % 2 ? 'Branco' : 'Preto',
      condition: index % 3 === 0 ? 'NOVO' : index % 3 === 1 ? 'SEMINOVO' : 'CPO',
    }));
    const calls: string[] = [];

    const result = await prepareOfferDraftBatch(targets, async (target) => {
      calls.push(target.id);
      return draftFor(target);
    });

    assert.deepEqual(calls, targets.map((target) => target.id));
    assert.equal(result.drafts.length, count);
    assert.equal(result.failedIds.length, 0);
    assert.deepEqual(
      result.drafts.map((draft) => draft.payload.color),
      targets.map((target) => target.color),
    );
  });
}

test('keeps successful drafts when one selected item fails', async () => {
  const targets: Target[] = [
    { id: 'one', supplier: 'A', color: 'Preto', condition: 'NOVO' },
    { id: 'two', supplier: 'B', color: 'Branco', condition: 'SEMINOVO' },
    { id: 'three', supplier: 'C', color: 'Azul', condition: 'CPO' },
  ];

  const result = await prepareOfferDraftBatch(targets, async (target) => {
    if (target.id === 'two') throw new Error('Falha controlada');
    return draftFor(target);
  });

  assert.deepEqual(result.successfulIds, ['one', 'three']);
  assert.deepEqual(result.failedIds, ['two']);
  assert.equal(result.drafts.length, 2);
  assert.deepEqual(result.errors, ['Falha controlada']);
});

test('ignores a duplicated selected identifier', async () => {
  const target: Target = { id: 'same', supplier: 'A', color: 'Preto', condition: 'NOVO' };
  let calls = 0;

  const result = await prepareOfferDraftBatch([target, target], async (item) => {
    calls += 1;
    return draftFor(item);
  });

  assert.equal(calls, 1);
  assert.equal(result.drafts.length, 1);
});

test('applies the same offer increment decision to every selected draft', async () => {
  const salePrices = [4349, 5370, 6449, 7070, 8249];
  const targets = salePrices.map((salePrice, index) => ({
    id: `product-${index + 1}`,
    supplier: 'Fornecedor',
    color: 'Preto',
    condition: 'NOVO',
    salePrice,
  }));
  const prepareDraft = (target: (typeof targets)[number], includeOfferIncrement: boolean) => {
    const draft = draftFor(target);
    return applyOfferDraftPrice(
      { ...draft, payload: { ...draft.payload, salePrice: target.salePrice } },
      includeOfferIncrement,
      100,
    );
  };

  const withIncrement = await prepareOfferDraftBatch(targets, async (target) =>
    prepareDraft(target, true),
  );
  const withoutIncrement = await prepareOfferDraftBatch(targets, async (target) =>
    prepareDraft(target, false),
  );

  assert.deepEqual(withIncrement.drafts.map((draft) => draft.payload.offerPrice), [4449, 5470, 6549, 7170, 8349]);
  assert.deepEqual(withoutIncrement.drafts.map((draft) => draft.payload.offerPrice), salePrices);
  assert.deepEqual(withIncrement.drafts.map((draft) => draft.payload.salePrice), salePrices);
});
