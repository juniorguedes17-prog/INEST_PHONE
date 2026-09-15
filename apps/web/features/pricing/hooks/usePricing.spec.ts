import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveOfferProductType, resolveOfferProductType } from './usePricing';

test('derives Apple offer types exclusively from classification and condition', () => {
  for (const productName of ['iPhone', 'iPad', 'MacBook']) {
    assert.equal(deriveOfferProductType('APPLE', 'NOVO'), 'IPHONE_SEALED', productName);
    assert.equal(deriveOfferProductType('APPLE', 'SEMINOVO'), 'IPHONE_USED', productName);
    assert.equal(deriveOfferProductType('APPLE', 'CPO'), 'IPHONE_USED', productName);
  }
});

test('preserves ACCESSORY for Non-Apple controls regardless of condition', () => {
  for (const manufacturer of ['Canon', 'Garmin', 'Samsung']) {
    assert.equal(deriveOfferProductType('NON_APPLE', 'NOVO'), 'ACCESSORY', manufacturer);
    assert.equal(deriveOfferProductType('NON_APPLE', 'SEMINOVO'), 'ACCESSORY', manufacturer);
    assert.equal(deriveOfferProductType('NON_APPLE', 'CPO'), 'ACCESSORY', manufacturer);
  }
});

test('does not promote unresolved classification to an Apple offer type', () => {
  assert.equal(deriveOfferProductType('UNRESOLVED', 'NOVO'), 'ACCESSORY');
  assert.equal(deriveOfferProductType('UNRESOLVED', 'SEMINOVO'), 'ACCESSORY');
  assert.equal(deriveOfferProductType('UNRESOLVED', 'CPO'), 'ACCESSORY');
});

test('keeps Apple without a resolved condition fail-closed', () => {
  assert.equal(resolveOfferProductType('APPLE', null), null);
});
