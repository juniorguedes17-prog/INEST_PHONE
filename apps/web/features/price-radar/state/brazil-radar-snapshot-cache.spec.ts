import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearBrazilRadarSnapshotCache,
  getBrazilRadarSnapshotCache,
  initialPriceRadarFilters,
  revalidateBrazilRadarSnapshot,
  setBrazilRadarFilters,
} from './brazil-radar-snapshot-cache';
import { PriceQuoteItem, PriceRadarFilters } from '../types/price-radar';

function quote(id: string, updatedAt = '2026-08-18T10:00:00.000Z'): PriceQuoteItem {
  return {
    id,
    productId: `product-${id}`,
    supplierId: 'supplier-1',
    productName: `Produto ${id}`,
    category: 'iPhone',
    model: 'iPhone 17',
    color: 'Azul',
    capacity: '256GB',
    productType: 'IPHONE_SEALED',
    quality: 'Novo',
    supplier: { id: 'supplier-1', name: 'Fornecedor' },
    city: 'Sao Paulo',
    deliveryTime: 'Imediato',
    contact: '',
    notes: '',
    costProduct: 4300,
    quoteDate: '2026-08-18',
    updatedAt,
    status: 'valid',
    valid: true,
    inconsistencies: [],
  };
}

function response(items: PriceQuoteItem[]) {
  return {
    items,
    kpis: {
      lowestValidPrice: 4300,
      averagePrice: 4300,
      highestPrice: 4300,
      hiddenCount: 0,
    },
  };
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test('primeira entrada armazena um unico snapshot e resposta igual preserva a referencia', async () => {
  clearBrazilRadarSnapshotCache();
  const firstItems = [quote('quote-1')];

  const first = await revalidateBrazilRadarSnapshot(initialPriceRadarFilters, async () => response(firstItems));
  const cachedItems = getBrazilRadarSnapshotCache().items;
  const cachedIndex = getBrazilRadarSnapshotCache().facetIndex;
  const second = await revalidateBrazilRadarSnapshot(initialPriceRadarFilters, async () =>
    response([{ ...firstItems[0]! }]),
  );

  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(getBrazilRadarSnapshotCache().items, cachedItems);
  assert.equal(getBrazilRadarSnapshotCache().facetIndex, cachedIndex);
});

test('gatilhos simultaneos para o mesmo snapshot compartilham uma unica requisicao', async () => {
  clearBrazilRadarSnapshotCache();
  const pending = deferred<ReturnType<typeof response>>();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return pending.promise;
  };

  const first = revalidateBrazilRadarSnapshot(initialPriceRadarFilters, fetcher);
  const second = revalidateBrazilRadarSnapshot(initialPriceRadarFilters, fetcher);
  pending.resolve(response([quote('quote-1')]));
  await Promise.all([first, second]);

  assert.equal(calls, 1);
});

test('resposta antiga nao sobrescreve uma revalidacao mais recente', async () => {
  clearBrazilRadarSnapshotCache();
  const firstPending = deferred<ReturnType<typeof response>>();
  const secondPending = deferred<ReturnType<typeof response>>();
  const secondFilters: PriceRadarFilters = {
    ...initialPriceRadarFilters,
    search: 'iPhone 17',
  };

  const first = revalidateBrazilRadarSnapshot(initialPriceRadarFilters, async () => firstPending.promise);
  setBrazilRadarFilters(secondFilters);
  const second = revalidateBrazilRadarSnapshot(secondFilters, async () => secondPending.promise);
  secondPending.resolve(response([quote('newer')]));
  await second;
  firstPending.resolve(response([quote('older')]));
  await first;

  assert.equal(getBrazilRadarSnapshotCache().items[0]?.id, 'newer');
  assert.equal(getBrazilRadarSnapshotCache().filters.search, 'iPhone 17');
});

test('falha de revalidacao preserva o snapshot anterior', async () => {
  clearBrazilRadarSnapshotCache();
  await revalidateBrazilRadarSnapshot(initialPriceRadarFilters, async () => response([quote('quote-1')]));
  const cachedItems = getBrazilRadarSnapshotCache().items;

  await assert.rejects(
    revalidateBrazilRadarSnapshot(initialPriceRadarFilters, async () => {
      throw new Error('API indisponivel');
    }),
  );

  assert.equal(getBrazilRadarSnapshotCache().items, cachedItems);
  assert.equal(getBrazilRadarSnapshotCache().error, 'API indisponivel');
});
