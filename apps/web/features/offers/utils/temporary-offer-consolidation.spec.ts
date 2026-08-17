import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '../../pricing/types/pricing';
import { CommercialTemplate } from '../types/offers';
import {
  prepareConsolidatedTemporaryOffers,
  prepareTemporaryOffer,
} from './temporary-offer-consolidation';

const sealedTemplate: CommercialTemplate = {
  id: 'sealed',
  name: 'Lacrados',
  productType: 'IPHONE_SEALED',
  status: 'ACTIVE',
  content: `HEADER {{garantia}} {{prazo}}

📱 {{produto}}
{{cor}} {{capacidade}}
💰 {{preco_oferta}}

CTA`,
};

const usedTemplate: CommercialTemplate = {
  ...sealedTemplate,
  id: 'used',
  name: 'Seminovos',
  productType: 'IPHONE_USED',
  content: sealedTemplate.content.replace('HEADER', 'HEADER USADO').replace('CTA', 'CTA USADO'),
};

const runtimeSealedTemplate: CommercialTemplate = {
  id: 'same-template-id',
  name: 'Template Oficial - Produtos Lacrados',
  productType: 'IPHONE_SEALED',
  status: 'ACTIVE',
  content: `HEADER EDITAVEL {{garantia}} {{prazo}}

📱 {{modelo}}

{{cores}}

CTA EDITAVEL`,
};

function draft(index: number, productType = 'IPHONE_SEALED'): OfferDraft {
  return {
    targetModule: 'offers',
    route: '/offers',
    productType,
    payload: {
      productId: `product-${index}`,
      productName: `iPhone ${index}`,
      color: index % 2 ? 'Preto' : 'Branco',
      capacity: '256GB',
      salePrice: 6000 + index,
      offerPrice: 5900 + index,
      deliveryTime: 'Entrega imediata',
      warranty: 'Garantia iNest',
    },
  };
}

function prepare(drafts: OfferDraft[]) {
  return drafts.map((item) => {
    const result = prepareTemporaryOffer(item, [sealedTemplate, usedTemplate]);
    assert.ok(result);
    return result;
  });
}

function prepareWithTemplate(drafts: OfferDraft[], template: CommercialTemplate) {
  return drafts.map((item) => {
    const result = prepareTemporaryOffer(item, [template]);
    assert.ok(result);
    return result;
  });
}

function occurrences(message: string, value: string) {
  return message.split(value).length - 1;
}

test('keeps the one-draft message identical', () => {
  const [prepared] = prepare([draft(1)]);
  assert.ok(prepared);

  const [consolidated] = prepareConsolidatedTemporaryOffers([prepared]);
  assert.ok(consolidated);
  assert.equal(consolidated.message, prepared.message);
});

test('consolidates five runtime drafts with the same editable template id', () => {
  const drafts = Array.from({ length: 5 }, (_, index) => draft(index + 1));
  const input = prepareWithTemplate(drafts, runtimeSealedTemplate);
  const output = prepareConsolidatedTemporaryOffers(input);

  assert.equal(input.length, 5);
  assert.equal(output.length, 1);
  const [consolidated] = output;
  assert.ok(consolidated);
  assert.equal(occurrences(consolidated.message, 'HEADER EDITAVEL'), 1);
  assert.equal(occurrences(consolidated.message, 'CTA EDITAVEL'), 1);

  drafts.forEach((item) => {
    assert.ok(consolidated.message.includes(item.payload.productName));
    assert.ok(consolidated.message.includes(item.payload.color));
    assert.ok(consolidated.message.includes(item.payload.capacity));
    assert.ok(
      consolidated.message.includes(
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          item.payload.offerPrice,
        ),
      ),
    );
  });
});

for (const count of [2, 5, 10]) {
  test(`consolidates ${count} sealed drafts with one header and CTA`, () => {
    const drafts = Array.from({ length: count }, (_, index) => draft(index + 1));
    const [consolidated] = prepareConsolidatedTemporaryOffers(prepare(drafts));
    assert.ok(consolidated);
    assert.equal(prepareConsolidatedTemporaryOffers(prepare(drafts)).length, 1);
    assert.equal(occurrences(consolidated.message, 'HEADER'), 1);
    assert.equal(occurrences(consolidated.message, 'CTA'), 1);

    drafts.forEach((item) => {
      assert.ok(consolidated.message.includes(item.payload.productName));
      assert.ok(consolidated.message.includes(item.payload.color));
      assert.ok(
        consolidated.message.includes(
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
            item.payload.offerPrice,
          ),
        ),
      );
    });
  });
}

test('separates five sealed and three used drafts by resolved template', () => {
  const consolidated = prepareConsolidatedTemporaryOffers(
    prepare([
      ...Array.from({ length: 5 }, (_, index) => draft(index + 1)),
      ...Array.from({ length: 3 }, (_, index) => draft(index + 6, 'IPHONE_USED')),
    ]),
  );

  assert.equal(consolidated.length, 2);
  assert.deepEqual(consolidated.map((item) => item.template?.id), ['sealed', 'used']);
  assert.equal(occurrences(consolidated[0]?.message ?? '', 'HEADER'), 1);
  assert.equal(occurrences(consolidated[1]?.message ?? '', 'HEADER USADO'), 1);
});

test('keeps draft order inside a consolidated template group', () => {
  const [consolidated] = prepareConsolidatedTemporaryOffers(prepare([draft(4), draft(2), draft(9)]));
  assert.ok(consolidated);

  const positions = ['iPhone 4', 'iPhone 2', 'iPhone 9'].map((name) =>
    consolidated.message.indexOf(name),
  );
  assert.ok(positions[0]! < positions[1]! && positions[1]! < positions[2]!);
});
