import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isPublicContractToken,
  isResolvedPublicContractLink,
  publicContractLinkUrl,
  toCreatedPublicContractLink,
} from './public-contract-link';

const validToken = 'A'.repeat(43);

test('accepts only the base64url token format emitted by F2.2', () => {
  assert.equal(isPublicContractToken(validToken), true);
  assert.equal(isPublicContractToken('too-short'), false);
  assert.equal(isPublicContractToken(`${validToken}=`), false);
  assert.equal(isPublicContractToken('!'.repeat(43)), false);
});

test('only exposes the public form when the link resolver confirms an active link', () => {
  assert.equal(isResolvedPublicContractLink(true, null), true);
  assert.equal(isResolvedPublicContractLink(false, null), false);
  assert.equal(isResolvedPublicContractLink(true, new Error('resolver unavailable')), false);
});

test('accepts only a complete creation result before displaying a public link', () => {
  assert.deepEqual(
    toCreatedPublicContractLink({ contract_id: 'a5ba3861-45ed-4cb2-a832-77f772f8e4e9', public_token: validToken }),
    { contractId: 'a5ba3861-45ed-4cb2-a832-77f772f8e4e9', publicToken: validToken },
  );
  assert.equal(toCreatedPublicContractLink({ contract_id: 'contract', public_token: 'invalid' }), null);
});

test('builds the public route from a token without an internal contract identifier', () => {
  assert.equal(
    publicContractLinkUrl('https://contracts.inest.example', validToken),
    `https://contracts.inest.example/c/${validToken}`,
  );
});
