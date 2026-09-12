import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveUsaProductDisplayName } from './usa-product-display-name';

const amazonCanonSourceName =
  'Amazon.com : Canon EOS Rebel T7 DSLR Camera EF-S 18-55mm f/3.5-5.6 is II Lens Kit, 24.1 Megapixel CMOS (APS-C) Sensor, Full HD Videos, Built-in Wi-Fi, Beginner Photographers, Digital Camera, Black : Electronics';

test('prefers a validated commercial name over every mechanical fallback', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Long raw Garmin retailer title',
      displayName: 'Garmin vivoactive 5',
      commercialName: '  Garmin vivoactive 5 42mm Black  ',
      sourceManufacturer: 'Garmin',
      model: 'vivoactive 5',
      color: 'Black',
    }),
    'Garmin vivoactive 5 42mm Black',
  );
});

test('builds a timeout-safe presentation name from existing structured fields', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Long raw Garmin retailer title',
      displayName: 'Long raw Garmin retailer title',
      commercialName: null,
      sourceManufacturer: 'Garmin',
      category: 'Wearable',
      model: 'vivoactive 5',
      capacity: null,
      color: 'Black',
      condition: null,
    }),
    'Garmin vivoactive 5 Black',
  );
});

test('uses partial structured fields without requiring model, storage, or condition', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Long retailer title',
      sourceManufacturer: 'Acme',
      category: 'Smartwatch',
      color: 'Black',
    }),
    'Acme Smartwatch Black',
  );
});

test('removes only mechanically equal structured values', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Long retailer title',
      sourceManufacturer: 'Vívoactive®',
      model: 'vivoactive',
      capacity: '42 mm',
      color: '42 mm',
    }),
    'Vívoactive® 42 mm',
  );
});

test('uses an existing distinct displayName when structured fields are insufficient', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Long raw retailer title',
      displayName: 'Existing mechanical display name',
      sourceManufacturer: null,
      model: null,
    }),
    'Existing mechanical display name',
  );
});

test('keeps the real Canon timeout title when its observed fields cannot identify the product', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: amazonCanonSourceName,
      displayName: amazonCanonSourceName,
      commercialName: null,
      sourceManufacturer: null,
      category: 'Electronics',
      model: null,
      capacity: null,
      color: 'Black',
      condition: null,
    }),
    amazonCanonSourceName,
  );
});

test('uses a structured Canon name when the source already provides the identity', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: amazonCanonSourceName,
      displayName: amazonCanonSourceName,
      sourceManufacturer: 'Canon',
      category: 'Camera',
      model: 'EOS Rebel T7',
      color: 'Black',
    }),
    'Canon EOS Rebel T7 Black',
  );
});

test('keeps a clean iPhone presentation equivalent without category duplication', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'iPhone 18 Pro 256GB Glacier',
      displayName: 'iPhone 18 Pro 256GB Glacier',
      category: 'iPhone',
      model: 'iPhone 18 Pro',
      capacity: '256GB',
      color: 'Glacier',
    }),
    'iPhone 18 Pro 256GB Glacier',
  );
});

test('falls back to sourceName when every presentation input is absent', () => {
  assert.equal(
    resolveUsaProductDisplayName({
      sourceName: 'Original source title',
      displayName: null,
      commercialName: null,
      sourceManufacturer: null,
      category: null,
      model: null,
      capacity: null,
      color: null,
      condition: null,
    }),
    'Original source title',
  );
});

test('does not mutate the original source product evidence', () => {
  const input = {
    sourceName: amazonCanonSourceName,
    displayName: amazonCanonSourceName,
    commercialName: null,
    sourceManufacturer: 'Canon',
    category: 'Camera',
    model: 'EOS Rebel T7',
    capacity: null,
    color: 'Black',
    condition: null,
  };
  const before = structuredClone(input);

  resolveUsaProductDisplayName(input);

  assert.deepEqual(input, before);
});
