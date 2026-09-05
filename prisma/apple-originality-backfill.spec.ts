import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  backfillAppleOriginality,
  inspectOriginality,
  OriginalityBackfillBlocked,
  type OriginalityDatabase,
  type OriginalityProduct,
  type OriginalityStore,
} from './apple-originality-backfill';
import { APPLE_ORIGINAL_PROFIT_PRODUCT_IDS as manifest } from './data/apple-originality.manifest';

function products(value: boolean | null = null): OriginalityProduct[] {
  return manifest.map((profitProductId) => ({
    id: `product-${profitProductId}`,
    profitProductId,
    isAppleOriginal: value,
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  }));
}

function fakeDatabase(initial: OriginalityProduct[]) {
  let committed = structuredClone(initial);
  const writes: Parameters<OriginalityStore['product']['updateMany']>[0][] = [];
  let reads = 0;
  const hooks: {
    beforeWrite?: (rows: OriginalityProduct[]) => void;
    afterWrite?: (rows: OriginalityProduct[]) => void;
  } = {};
  const database: OriginalityDatabase = {
    async $transaction(action, options) {
      assert.deepEqual(options, { isolationLevel: 'Serializable' });
      const draft = structuredClone(committed);
      const result = await action({
        product: {
          async findMany(args) {
            reads += 1;
            assert.deepEqual(args.select, {
              id: true,
              profitProductId: true,
              isAppleOriginal: true,
              updatedAt: true,
            });
            return structuredClone(draft);
          },
          async updateMany(args) {
            writes.push(args);
            assert.deepEqual(args.data, { isAppleOriginal: true });
            assert.deepEqual(args.where.profitProductId.in, manifest);
            assert.equal(args.where.isAppleOriginal, null);
            hooks.beforeWrite?.(draft);
            let count = 0;
            for (const row of draft) {
              if (
                args.where.id.in.includes(row.id) &&
                row.profitProductId !== null &&
                args.where.profitProductId.in.includes(row.profitProductId) &&
                row.isAppleOriginal === null
              ) {
                row.isAppleOriginal = true;
                row.updatedAt = new Date('2026-09-04T00:00:00.000Z');
                count += 1;
              }
            }
            hooks.afterWrite?.(draft);
            return { count };
          },
        },
      });
      committed = draft;
      return result;
    },
  };
  return { database, writes, hooks, rows: () => structuredClone(committed), reads: () => reads };
}

test('manifest has exactly the 131 unique approved catalog IDs, without filling numeric gaps', () => {
  const catalog = JSON.parse(
    readFileSync(new URL('./data/profit-products.json', import.meta.url), 'utf8'),
  ) as Array<{ produto_id: number }>;
  assert.equal(manifest.length, 131);
  assert.equal(new Set(manifest).size, 131);
  assert.deepEqual(
    [...manifest].sort((a, b) => a - b),
    catalog.map((row) => row.produto_id).sort((a, b) => a - b),
  );
  for (const id of [125, 128, 129, 135]) assert.equal(manifest.includes(id), false);
  assert.equal(Object.isFrozen(manifest), true);
});

test('default dry-run reports all counters before any write and leaves state unchanged', async () => {
  const initial = products();
  initial[0]!.isAppleOriginal = true;
  const store = fakeDatabase(initial);
  const result = await backfillAppleOriginality(store.database, {
    onPreflight: (report) => {
      assert.equal(store.writes.length, 0);
      assert.equal(report.found, 131);
    },
  });
  assert.deepEqual(result.preflight, {
    expected: 131,
    manifestCount: 131,
    found: 131,
    null: 130,
    alreadyTrue: 1,
    conflictingFalse: 0,
    missing: 0,
    duplicates: 0,
    outsideManifestAffected: 0,
    conflictingIds: [],
    missingIds: [],
    duplicateIds: [],
    invalidIds: [],
    invalidStateIds: [],
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.updated, 0);
  assert.equal(result.postflight, null);
  assert.equal(store.writes.length, 0);
  assert.deepEqual(store.rows(), initial);
});

test('apply changes only approved nulls to true; second execution makes no write or timestamp change', async () => {
  const initial = products();
  initial[0]!.isAppleOriginal = true;
  const store = fakeDatabase(initial);
  const first = await backfillAppleOriginality(store.database, { apply: true });
  assert.equal(first.updated, 130);
  assert.equal(first.postflight?.alreadyTrue, 131);
  assert.equal(first.postflight?.null, 0);
  assert.equal(first.postflight?.outsideManifestAffected, 0);
  assert.deepEqual(store.rows()[0], initial[0]);
  const afterFirst = store.rows();
  assert.equal(
    afterFirst.every((row) => row.isAppleOriginal === true),
    true,
  );
  const second = await backfillAppleOriginality(store.database, { apply: true });
  assert.equal(second.updated, 0);
  assert.equal(second.preflight.alreadyTrue, 131);
  assert.equal(store.writes.length, 1);
  assert.deepEqual(store.rows(), afterFirst);
});

for (const apply of [false, true]) {
  test(`false blocks the entire batch before writes (apply=${apply})`, async () => {
    const initial = products();
    initial[130]!.isAppleOriginal = false;
    const store = fakeDatabase(initial);
    await assert.rejects(backfillAppleOriginality(store.database, { apply }), (error: unknown) => {
      assert.ok(error instanceof OriginalityBackfillBlocked);
      assert.equal(error.report.conflictingFalse, 1);
      assert.deepEqual(error.report.conflictingIds, [134]);
      return true;
    });
    assert.equal(store.writes.length, 0);
    assert.deepEqual(store.rows(), initial);
  });
}

test('missing approved Product blocks the batch without creating Products', async () => {
  const initial = products().slice(1);
  const store = fakeDatabase(initial);
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    (error: unknown) => {
      assert.ok(error instanceof OriginalityBackfillBlocked);
      assert.equal(error.report.found, 130);
      assert.deepEqual(error.report.missingIds, [1]);
      return true;
    },
  );
  assert.equal(store.writes.length, 0);
  assert.deepEqual(store.rows(), initial);
});

test('duplicate database profitProductId blocks all writes', async () => {
  const initial = products();
  initial.push({ ...initial[0]!, id: 'duplicate-product' });
  const store = fakeDatabase(initial);
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    (error: unknown) => {
      assert.ok(error instanceof OriginalityBackfillBlocked);
      assert.equal(error.report.duplicates, 1);
      assert.deepEqual(error.report.duplicateIds, [1]);
      return true;
    },
  );
  assert.equal(store.writes.length, 0);
});

test('manifest audit detects duplicated, missing and invalid IDs', () => {
  const duplicated = inspectOriginality(products(), [...manifest.slice(0, -1), 1]);
  assert.equal(duplicated.duplicates, 1);
  assert.deepEqual(duplicated.missingIds, []);
  assert.equal(duplicated.found, 130);
  assert.equal(inspectOriginality(products(), manifest.slice(1)).manifestCount, 130);
  assert.deepEqual(inspectOriginality(products(), [...manifest.slice(1), -1]).invalidIds, [-1]);
});

test('outside IDs and unclassified Products remain byte-for-byte unchanged, including false', async () => {
  const outside = [null, false, true].map((isAppleOriginal, index) => ({
    id: `outside-${index}`,
    profitProductId: index === 0 ? null : 900 + index,
    isAppleOriginal,
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  }));
  const store = fakeDatabase([...products(), ...outside]);
  const result = await backfillAppleOriginality(store.database, { apply: true });
  assert.deepEqual(store.rows().slice(131), outside);
  assert.equal(result.postflight?.outsideManifestAffected, 0);
  assert.equal(
    store.writes[0]!.where.id.in.some((id) => id.startsWith('outside')),
    false,
  );
});

for (const field of ['productType', 'category', 'model', 'productDescription', 'brand']) {
  test(`${field} cannot influence classification; approved IDs are the only authority`, async () => {
    const initial = products().map((row) => ({
      ...row,
      [field]: 'unknown or third-party source data',
      netProfit: 500,
      active: false,
    }));
    const outside = {
      ...initial[0]!,
      id: 'outside-apple',
      profitProductId: 999,
      [field]: 'Apple',
      isAppleOriginal: null,
    };
    const store = fakeDatabase([...initial, outside]);
    await backfillAppleOriginality(store.database, { apply: true });
    assert.equal(store.rows()[0]!.isAppleOriginal, true);
    assert.deepEqual(store.rows().at(-1), outside);
    const after = store.rows()[0] as OriginalityProduct & Record<string, unknown>;
    assert.equal(after[field], 'unknown or third-party source data');
    assert.equal(after.netProfit, 500);
    assert.equal(after.active, false);
  });
}

test('unknown classification value is blocked instead of coerced to false/null', async () => {
  const initial = products();
  initial[0]!.isAppleOriginal = undefined as unknown as null;
  const store = fakeDatabase(initial);
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    (error: unknown) => {
      assert.ok(error instanceof OriginalityBackfillBlocked);
      assert.deepEqual(error.report.invalidStateIds, ['product-1']);
      return true;
    },
  );
  assert.equal(store.writes.length, 0);
});

test('concurrent false is not overwritten and changed-row mismatch rolls back all writes', async () => {
  const initial = products();
  const store = fakeDatabase(initial);
  store.hooks.beforeWrite = (rows) => {
    rows[0]!.isAppleOriginal = false;
  };
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    /write_count_mismatch/,
  );
  assert.deepEqual(store.rows(), initial);
});

test('failed postflight rolls back the batch', async () => {
  const initial = products();
  const store = fakeDatabase(initial);
  store.hooks.afterWrite = (rows) => {
    rows[0]!.isAppleOriginal = null;
  };
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    /postflight_failed/,
  );
  assert.deepEqual(store.rows(), initial);
});

test('unexpected outside classification/timestamp change is detected and rolled back', async () => {
  const initial = [...products(), { ...products()[0]!, id: 'outside', profitProductId: 999 }];
  const store = fakeDatabase(initial);
  store.hooks.afterWrite = (rows) => {
    rows.at(-1)!.isAppleOriginal = true;
  };
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    (error: unknown) => {
      assert.ok(error instanceof OriginalityBackfillBlocked);
      assert.equal(error.report.outsideManifestAffected, 1);
      return true;
    },
  );
  assert.deepEqual(store.rows(), initial);
});

test('already-true timestamps must remain unchanged even during a mixed batch', async () => {
  const initial = products();
  initial[0]!.isAppleOriginal = true;
  const store = fakeDatabase(initial);
  store.hooks.afterWrite = (rows) => {
    rows[0]!.updatedAt = new Date();
  };
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    /postflight_failed/,
  );
  assert.deepEqual(store.rows(), initial);
});

test('database failure aborts and cannot report successful completion', async () => {
  const initial = products();
  const store = fakeDatabase(initial);
  store.hooks.afterWrite = () => {
    throw new Error('database failure');
  };
  await assert.rejects(
    backfillAppleOriginality(store.database, { apply: true }),
    /database failure/,
  );
  assert.deepEqual(store.rows(), initial);
});
