import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareBrazilRadarPricingBatch } from './brazil-radar-pricing-batch';

function pricing(sourceQuoteId: string) {
  return { sourceQuoteId } as never;
}

test('prepares one, two, five, and ten selected Brazil Radar quotes independently', async () => {
  for (const count of [1, 2, 5, 10]) {
    const calls: string[] = [];
    const quotes = Array.from({ length: count }, (_, index) => ({
      id: `quote-${index + 1}`,
      source: 'BRAZIL_RADAR' as const,
      sourceQuoteId: `source-${index + 1}`,
    }));

    const result = await prepareBrazilRadarPricingBatch(quotes, async (sourceQuoteId) => {
      calls.push(sourceQuoteId);
      return pricing(sourceQuoteId);
    });

    assert.deepEqual(
      calls,
      quotes.map((quote) => quote.sourceQuoteId),
    );
    assert.equal(result.items.length, count);
    assert.deepEqual(
      result.successfulQuoteIds,
      quotes.map((quote) => quote.id),
    );
    assert.deepEqual(result.failedQuoteIds, []);
  }
});

test('keeps successful quotes when one selected quote fails', async () => {
  const result = await prepareBrazilRadarPricingBatch(
    [
      { id: 'iphone', source: 'BRAZIL_RADAR', sourceQuoteId: 'iphone-source' },
      { id: 'invalid', source: 'BRAZIL_RADAR', sourceQuoteId: 'invalid-source' },
      { id: 'watch', source: 'BRAZIL_RADAR', sourceQuoteId: 'watch-source' },
    ],
    async (sourceQuoteId) => {
      if (sourceQuoteId === 'invalid-source') throw new Error('Cotacao indisponivel.');
      return pricing(sourceQuoteId);
    },
  );

  assert.deepEqual(result.successfulQuoteIds, ['iphone', 'watch']);
  assert.deepEqual(result.failedQuoteIds, ['invalid']);
  assert.equal(result.items.length, 2);
  assert.deepEqual(result.errors, ['Cotacao indisponivel.']);
});

test('does not calculate a duplicated source quote more than once', async () => {
  let calls = 0;
  const result = await prepareBrazilRadarPricingBatch(
    [
      { id: 'first', source: 'BRAZIL_RADAR', sourceQuoteId: 'same-source' },
      { id: 'second', source: 'BRAZIL_RADAR', sourceQuoteId: 'same-source' },
    ],
    async (sourceQuoteId) => {
      calls += 1;
      return pricing(sourceQuoteId);
    },
  );

  assert.equal(calls, 1);
  assert.deepEqual(result.successfulQuoteIds, ['first', 'second']);
  assert.equal(result.items.length, 1);
});
