import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalFamilyRegistry,
  resolveCanonicalFamily,
  validateCanonicalFamilyRegistry,
  type CanonicalFamilyDefinition,
} from './canonical-family-registry';
import {
  canonicalModelRegistry,
  validateCanonicalModelFamilyReferences,
  type CanonicalModelRegistryEntry,
} from './canonical-model-registry';
import { normalizeCanonicalProductIdentity } from './canonical-product-identity';

test('valida as definicoes reais de familia e o membership declarativo dos modelos', () => {
  assert.doesNotThrow(() => validateCanonicalFamilyRegistry(canonicalFamilyRegistry));
  assert.doesNotThrow(() =>
    validateCanonicalModelFamilyReferences(canonicalModelRegistry, canonicalFamilyRegistry),
  );
  assert.equal(canonicalModelRegistry.every((model) => model.familyKey !== 'unknown'), true);
});

test('rejeita chave de familia duplicada e alias normalizado conflitante', () => {
  const duplicateKey = [
    family('iphone', ['iphone']),
    family('iphone', ['iph']),
  ] as const;
  const conflictingAlias = [
    family('iphone', ['Família Única']),
    family('ipad', ['familia unica']),
  ] as const;

  assert.throws(
    () => validateCanonicalFamilyRegistry(duplicateKey),
    /Duplicate canonical family key: iphone/,
  );
  assert.throws(
    () => validateCanonicalFamilyRegistry(conflictingAlias),
    /Conflicting canonical family alias: familia unica/,
  );
});

test('rejeita chave de familia invalida e definicao sem aliases', () => {
  const invalidKey = family('iphone', ['iphone']);
  const missingAliases = family('ipad', []);

  assert.throws(
    () =>
      validateCanonicalFamilyRegistry([
        { ...invalidKey, key: 'invalid-family' } as unknown as CanonicalFamilyDefinition,
      ]),
    /Invalid canonical family key: invalid-family/,
  );
  assert.throws(
    () => validateCanonicalFamilyRegistry([missingAliases]),
    /Canonical family requires aliases: ipad/,
  );
});

test('rejeita familyKey de modelo que nao existe no Family Registry', () => {
  const invalidModel = {
    ...canonicalModelRegistry[0],
    key: 'invalid-model',
    familyKey: 'missing-family',
  } as unknown as CanonicalModelRegistryEntry;

  assert.throws(
    () => validateCanonicalModelFamilyReferences([invalidModel], canonicalFamilyRegistry),
    /Unknown canonical family key for model invalid-model: missing-family/,
  );
});

test('resolve familia por boundary declarativo sem depender da geracao do modelo', () => {
  assert.deepEqual(
    resolveCanonicalFamily(
      'Mac mini, M6 Chip, 12-core CPU, 12-core GPU, 24GB memory, 512GB storage',
    ),
    { status: 'matched', family: 'mac-mini', label: 'Mac Mini', classification: 'APPLE' },
  );
  assert.deepEqual(resolveCanonicalFamily('Produto XYZ Pro 512GB'), {
    status: 'unresolved',
    family: 'unknown',
    label: null,
    classification: null,
  });
});

test('falha fechada quando mais de uma familia controlada corresponde ao texto', () => {
  const registry = [
    family('iphone', ['shared family']),
    family('ipad', ['shared family']),
  ] as const;

  assert.deepEqual(resolveCanonicalFamily('shared family generation 1', registry), {
    status: 'ambiguous',
    family: 'unknown',
    label: null,
    classification: null,
  });
});

test('mantem familia e modelo independentes para a geracao M6 nao catalogada', () => {
  const modelCount = canonicalModelRegistry.length;
  const identity = normalizeCanonicalProductIdentity(
    'Mac mini, M6 Chip, 12-core CPU, 12-core GPU, 24GB memory, 512GB storage',
  );

  assert.deepEqual(
    {
      family: identity.canonicalFamily,
      familyStatus: identity.canonicalFamilyStatus,
      classification: identity.canonicalFamilyClassification,
      modelMatched: identity.canonicalModelMatched,
      modelKey: identity.canonicalModelKey,
      chip: identity.canonicalChip,
      ram: identity.canonicalRam,
      storage: identity.canonicalStorage,
    },
    {
      family: 'mac-mini',
      familyStatus: 'matched',
      classification: 'APPLE',
      modelMatched: false,
      modelKey: '',
      chip: 'M6',
      ram: '24GB',
      storage: '512GB',
    },
  );
  assert.equal(canonicalModelRegistry.some((model) => model.key === 'mac-mini-m6'), false);
  assert.equal(canonicalModelRegistry.length, modelCount);
});

test('preserva modelo conhecido e converge pelo membership declarativo', () => {
  const identity = normalizeCanonicalProductIdentity('Mac Mini M4 Pro 24GB 512GB');

  assert.deepEqual(
    {
      family: identity.canonicalFamily,
      familyStatus: identity.canonicalFamilyStatus,
      classification: identity.canonicalFamilyClassification,
      modelMatched: identity.canonicalModelMatched,
      modelKey: identity.canonicalModelKey,
      modelLabel: identity.canonicalModelLabel,
      chip: identity.canonicalChip,
      ram: identity.canonicalRam,
      storage: identity.canonicalStorage,
    },
    {
      family: 'mac-mini',
      familyStatus: 'matched',
      classification: 'APPLE',
      modelMatched: true,
      modelKey: 'mac-mini-m4-pro',
      modelLabel: 'Mac Mini M4 Pro',
      chip: 'M4 Pro',
      ram: '24GB',
      storage: '512GB',
    },
  );
});

function family(
  key: CanonicalFamilyDefinition['key'],
  aliases: readonly string[],
): CanonicalFamilyDefinition {
  return { key, label: key, classification: 'APPLE', aliases };
}
