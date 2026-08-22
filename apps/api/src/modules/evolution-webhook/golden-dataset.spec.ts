import { describe, expect, it } from 'vitest';
import { processParsedSupplierItemsShadow } from './product-identity-shadow';
import { parseSupplierListText } from './supplier-list.parser';
import { goldenCases, type GoldenCase } from './__fixtures__/golden';

function expectParsedItems(testCase: GoldenCase, items: ReturnType<typeof parseSupplierListText>) {
  if (testCase.expected.itemCount !== undefined) {
    expect(items, `${testCase.id}: parsed item count`).toHaveLength(testCase.expected.itemCount);
  }

  for (const expected of testCase.expected.parsedItems ?? []) {
    const { itemIndex, ...fields } = expected;
    expect(items[itemIndex], `${testCase.id}: parsed item ${itemIndex}`).toMatchObject(fields);
  }
}

function runGoldenCase(testCase: GoldenCase) {
  const items = parseSupplierListText(testCase.input.rawText);
  expectParsedItems(testCase, items);

  const observations = processParsedSupplierItemsShadow(items, testCase.catalog ?? []);
  for (const expected of testCase.expected.identities ?? []) {
    const { itemIndex, ...fields } = expected;
    expect(
      observations[itemIndex]?.identity.canonical,
      `${testCase.id}: identity ${itemIndex}`,
    ).toMatchObject(fields);
  }

  for (const expected of testCase.expected.resolutions ?? []) {
    const { itemIndex, productKey, ...fields } = expected;
    expect(
      observations[itemIndex]?.productResolution,
      `${testCase.id}: resolution ${itemIndex}`,
    ).toMatchObject({ ...fields, ...(productKey ? { productId: productKey } : {}) });
  }
}

describe('normalization golden dataset', () => {
  it.each(goldenCases)('[GOLDEN] $id', (testCase) => {
    runGoldenCase(testCase);
  });
});
