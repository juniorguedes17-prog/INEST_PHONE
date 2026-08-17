import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '../types/pricing';
import { prepareOfferDraftBatch } from './offer-draft-batch';

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
