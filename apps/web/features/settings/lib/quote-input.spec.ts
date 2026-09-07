import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuoteInput, parseQuoteInput } from './quote-input';

describe('quote input', () => {
  for (const [text, expected] of [
    ['5', 5],
    ['5,3', 5.3],
    ['5,35', 5.35],
    ['5.3', 5.3],
    ['5.35', 5.35],
    ['5,357', 5.357],
  ] as const) {
    it(`converts ${text} only on save to ${expected}`, () => {
      assert.equal(parseQuoteInput(text), expected);
    });
  }

  for (const text of ['texto', 'NaN', 'Infinity', '5,3.5', '5.3,5']) {
    it(`rejects malformed quote ${text}`, () => {
      assert.equal(Number.isNaN(parseQuoteInput(text)), true);
    });
  }

  it('leaves zero and negative range decisions to the field validators', () => {
    assert.equal(parseQuoteInput('0'), 0);
    assert.equal(parseQuoteInput('-1'), -1);
  });

  it('formats loaded numeric settings without losing precision', () => {
    assert.equal(formatQuoteInput(5.35), '5,35');
    assert.equal(formatQuoteInput(5.357), '5,357');
    assert.equal(formatQuoteInput(null), '');
  });
});
