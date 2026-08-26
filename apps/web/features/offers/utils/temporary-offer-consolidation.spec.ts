import assert from 'node:assert/strict';
import test from 'node:test';
import { OfferDraft } from '../../pricing/types/pricing';
import { CommercialTemplate } from '../types/offers';
import {
  prepareConsolidatedTemporaryOffers,
  prepareTemporaryOffer,
  renderTemporaryOfferMessage,
} from './temporary-offer-consolidation';
import { formatColorLabel } from './color-label';

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
  content: `HEADER EDITAVEL {{garantia}}

✈️ Prazo de entrega: {{prazo}}

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

function draftForProduct({
  id,
  productId,
  productName,
  color,
  capacity,
  offerPrice,
  productType = 'IPHONE_SEALED',
}: {
  id: string;
  productId: string | null;
  productName: string;
  color: string;
  capacity: string;
  offerPrice: number;
  productType?: string;
}): OfferDraft {
  return {
    targetModule: 'offers',
    route: '/offers',
    productType,
    payload: {
      productId,
      sourceQuoteId: `quote-${id}`,
      productName,
      color,
      capacity,
      salePrice: offerPrice + 200,
      offerPrice,
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

test('does not repeat storage already present in the product name', () => {
  const cases: Array<[string, string, string]> = [
    ['iPhone 16 128GB', '128 GB', '128GB'],
    ['iPhone 16 128 GB', '128GB', '128 GB'],
    ['iPhone 17 Pro 256GB', '256 GB', '256GB'],
    ['MacBook Air M5 512GB', '512GB', '512GB'],
    ['MacBook Pro 1TB', '1 TB', '1TB'],
  ];

  cases.forEach(([productName, capacity, representedCapacity]) => {
    const prepared = prepareTemporaryOffer(
      draftForProduct({
        id: productName,
        productId: productName,
        productName,
        color: 'Branco',
        capacity,
        offerPrice: 5000,
      }),
      [sealedTemplate],
    );

    assert.ok(prepared);
    assert.equal(countNormalizedStorage(prepared.message, representedCapacity), 1);
  });
});

test('adds storage when it is absent from the product name', () => {
  const prepared = prepareTemporaryOffer(
    draftForProduct({
      id: 'iphone-16',
      productId: 'iphone-16',
      productName: 'iPhone 16',
      color: 'Branco',
      capacity: '128GB',
      offerPrice: 5000,
    }),
    [sealedTemplate],
  );

  assert.ok(prepared);
  assert.equal(countNormalizedStorage(prepared.message, '128GB'), 1);
});

function countNormalizedStorage(message: string, capacity: string) {
  const normalizedMessage = message.toLocaleLowerCase('pt-BR').replace(/[\s-]+/g, '');
  const normalizedCapacity = capacity.toLocaleLowerCase('pt-BR').replace(/[\s-]+/g, '');
  return normalizedMessage.split(normalizedCapacity).length - 1;
}

test('preserves the creation timestamp carried by a new draft', () => {
  const createdAt = '2026-08-21T16:30:00.000Z';
  const prepared = prepareTemporaryOffer({ ...draft(1), createdAt }, [sealedTemplate]);

  assert.ok(prepared);
  assert.equal(prepared.createdAt, createdAt);
});

test('keeps legacy drafts without a creation timestamp absent', () => {
  const prepared = prepareTemporaryOffer(draft(1), [sealedTemplate]);

  assert.ok(prepared);
  assert.equal(prepared.createdAt, undefined);
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
    assert.ok(consolidated.message.includes(formatColorLabel(item.payload.color)));
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

test('groups four colors of the same product configuration into one variant block', () => {
  const productName = 'iPhone 17 256GB As Is';
  const drafts = [
    draftForProduct({
      id: 'black',
      productId: 'iphone-17-256-as-is',
      productName,
      color: 'Preto',
      capacity: '256GB',
      offerPrice: 5139,
    }),
    draftForProduct({
      id: 'blue',
      productId: 'iphone-17-256-as-is',
      productName,
      color: 'Azul',
      capacity: '256GB',
      offerPrice: 5189,
    }),
    draftForProduct({
      id: 'lavender',
      productId: 'iphone-17-256-as-is',
      productName,
      color: 'Lavender',
      capacity: '256GB',
      offerPrice: 5190,
    }),
    draftForProduct({
      id: 'white',
      productId: 'iphone-17-256-as-is',
      productName,
      color: 'Branco',
      capacity: '256GB',
      offerPrice: 5220,
    }),
  ];
  const [consolidated] = prepareConsolidatedTemporaryOffers(
    prepareWithTemplate(drafts, runtimeSealedTemplate),
  );

  assert.ok(consolidated);
  assert.equal(occurrences(consolidated.message, productName), 1);
  assert.equal(occurrences(consolidated.message, '256GB'), 1);
  assert.match(consolidated.message, /⚫️ Preto: R\$\s?5\.139,00/);
  assert.match(consolidated.message, /🔵 Azul: R\$\s?5\.189,00/);
  assert.match(consolidated.message, /🟣 Lilás: R\$\s?5\.190,00/);
  assert.match(consolidated.message, /⚪️ Branco: R\$\s?5\.220,00/);

  const positions = ['Preto', 'Azul', 'Lavender', 'Branco'].map((color) =>
    consolidated.message.indexOf(formatColorLabel(color)),
  );
  assert.ok(
    positions[0]! < positions[1]! && positions[1]! < positions[2]! && positions[2]! < positions[3]!,
  );
});

test('rerenders the consolidated message with each supported delivery time', () => {
  const drafts = Array.from({ length: 5 }, (_, index) => draft(index + 1));
  const [consolidated] = prepareConsolidatedTemporaryOffers(
    prepareWithTemplate(drafts, runtimeSealedTemplate),
  );
  assert.ok(consolidated);

  const deliveryTimes = [
    'Em até 3 dias úteis',
    'De 3 a 5 dias úteis',
    'De 5 a 7 dias úteis',
    'De 8 a 10 dias úteis',
    'De 11 a 15 dias úteis',
    'De 25 a 30 dias úteis',
  ];

  assert.match(
    renderTemporaryOfferMessage(consolidated, 'Prazo conforme oferta'),
    /Prazo conforme oferta/,
  );
  deliveryTimes.forEach((deliveryTime) => {
    const message = renderTemporaryOfferMessage(consolidated, deliveryTime);
    assert.match(message, new RegExp(`Prazo de entrega: ${deliveryTime}`));
    assert.equal(occurrences(message, 'HEADER EDITAVEL'), 1);
    assert.equal(occurrences(message, 'CTA EDITAVEL'), 1);
  });
});

test('keeps product configurations and seminovos separated when they cannot be proven equal', () => {
  const drafts = [
    draftForProduct({
      id: 'base-black',
      productId: 'iphone-17-256',
      productName: 'iPhone 17 256GB',
      color: 'Preto',
      capacity: '256GB',
      offerPrice: 5000,
    }),
    draftForProduct({
      id: 'base-blue',
      productId: 'iphone-17-256',
      productName: 'iPhone 17 256GB',
      color: 'Azul',
      capacity: '256GB',
      offerPrice: 5050,
    }),
    draftForProduct({
      id: 'pro-black',
      productId: 'iphone-17-pro-256',
      productName: 'iPhone 17 Pro 256GB',
      color: 'Preto',
      capacity: '256GB',
      offerPrice: 6500,
    }),
    draftForProduct({
      id: 'storage-128',
      productId: null,
      productName: 'iPhone 17 128GB',
      color: 'Branco',
      capacity: '128GB',
      offerPrice: 4700,
    }),
    draftForProduct({
      id: 'used-a',
      productId: 'iphone-used',
      productName: 'iPhone 17 256GB',
      color: 'Preto',
      capacity: '256GB',
      offerPrice: 4200,
      productType: 'IPHONE_USED',
    }),
    draftForProduct({
      id: 'used-b',
      productId: 'iphone-used',
      productName: 'iPhone 17 256GB',
      color: 'Azul',
      capacity: '256GB',
      offerPrice: 4250,
      productType: 'IPHONE_USED',
    }),
  ];
  const consolidated = prepareConsolidatedTemporaryOffers(
    prepareWithTemplate(drafts, runtimeSealedTemplate),
  );
  const [message] = consolidated.map((offer) => offer.message);

  assert.equal(consolidated.length, 1);
  assert.ok(message);
  assert.equal(occurrences(message, 'iPhone 17 256GB'), 3);
  assert.equal(occurrences(message, 'iPhone 17 Pro 256GB'), 1);
  assert.equal(occurrences(message, 'iPhone 17 128GB'), 1);
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
  assert.deepEqual(
    consolidated.map((item) => item.template?.id),
    ['sealed', 'used'],
  );
  assert.equal(occurrences(consolidated[0]?.message ?? '', 'HEADER'), 1);
  assert.equal(occurrences(consolidated[1]?.message ?? '', 'HEADER USADO'), 1);
});

test('keeps draft order inside a consolidated template group', () => {
  const [consolidated] = prepareConsolidatedTemporaryOffers(
    prepare([draft(4), draft(2), draft(9)]),
  );
  assert.ok(consolidated);

  const positions = ['iPhone 4', 'iPhone 2', 'iPhone 9'].map((name) =>
    consolidated.message.indexOf(name),
  );
  assert.ok(positions[0]! < positions[1]! && positions[1]! < positions[2]!);
});
