import { describe, expect, it } from 'vitest';
import { normalizeManufacturerAlias } from './manufacturer-alias-normalizer';
import { resolveManufacturer, type ManufacturerResolverAlias } from './manufacturer-resolver';

function alias(
  manufacturerKey: string,
  canonicalName: string,
  value = canonicalName,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): ManufacturerResolverAlias {
  return {
    id: `alias-${manufacturerKey}-${value}`,
    alias: value,
    normalizedAlias: normalizeManufacturerAlias(value),
    manufacturer: {
      id: `manufacturer-${manufacturerKey}`,
      manufacturerKey,
      canonicalName,
      status,
    },
  };
}

describe('resolveManufacturer', () => {
  it('returns FOUND for one exact active alias and preserves provenance', () => {
    expect(
      resolveManufacturer(
        {
          evidence: '  ACME  ',
          matchMode: 'EXACT_ALIAS',
          provenance: 'EXPLICIT_SOURCE_VALIDATED',
        },
        [alias('acme', 'Acme Industries', 'Acme')],
      ),
    ).toMatchObject({
      status: 'FOUND',
      manufacturerKey: 'acme',
      canonicalName: 'Acme Industries',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
      normalizedEvidence: 'acme',
      normalizedAlias: 'acme',
    });
  });

  it('returns MISSING for no match and never uses fuzzy similarity', () => {
    expect(
      resolveManufacturer(
        {
          evidence: 'Acm',
          matchMode: 'EXACT_ALIAS',
          provenance: 'EXPLICIT_SOURCE_VALIDATED',
        },
        [alias('acme', 'Acme Industries', 'Acme')],
      ),
    ).toMatchObject({ status: 'MISSING', normalizedEvidence: 'acm' });
  });

  it('returns AMBIGUOUS defensively for aliases that point to two identities', () => {
    const result = resolveManufacturer(
      {
        evidence: 'Orbit',
        matchMode: 'EXACT_ALIAS',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
      },
      [alias('orbit-one', 'Orbit One', 'Orbit'), alias('orbit-two', 'Orbit Two', 'Orbit')],
    );

    expect(result).toEqual({
      status: 'AMBIGUOUS',
      normalizedEvidence: 'orbit',
      manufacturerKeys: ['orbit-one', 'orbit-two'],
    });
  });

  it('does not resolve inactive manufacturers', () => {
    expect(
      resolveManufacturer(
        {
          evidence: 'Acme',
          matchMode: 'EXACT_ALIAS',
          provenance: 'EXPLICIT_SOURCE_VALIDATED',
        },
        [alias('acme', 'Acme Industries', 'Acme', 'INACTIVE')],
      ),
    ).toMatchObject({ status: 'MISSING' });
  });

  it('finds registered aliases in commercial text only at token boundaries', () => {
    const aliases = [alias('garmin', 'Garmin', 'Garmin')];
    expect(
      resolveManufacturer(
        {
          evidence: 'Garmin Vivoactive 6',
          matchMode: 'TEXT_BOUNDARY',
          provenance: 'DETERMINISTIC_ALIAS',
        },
        aliases,
      ),
    ).toMatchObject({ status: 'FOUND', manufacturerKey: 'garmin' });
    expect(
      resolveManufacturer(
        {
          evidence: 'Garminia Vivoactive 6',
          matchMode: 'TEXT_BOUNDARY',
          provenance: 'DETERMINISTIC_ALIAS',
        },
        aliases,
      ),
    ).toMatchObject({ status: 'MISSING' });
  });

  it.each([
    ['Acme Phone X', 'acme'],
    ['Acme Phone X, CPU 12-core, GPU 16-core, RAM 32GB, SSD 1TB', 'acme'],
    ['Samsung Galaxy Device RAM 8GB Storage 256GB', 'samsung'],
    ['Xiaomi Redmi Device, CPU Octa Core, RAM 4GB, Storage 128GB', 'xiaomi'],
  ])('isolates one registered manufacturer from structured evidence: %s', (evidence, key) => {
    const result = resolveManufacturer(
      {
        evidence,
        matchMode: 'TEXT_BOUNDARY',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
      },
      [alias('acme', 'Acme'), alias('samsung', 'Samsung'), alias('xiaomi', 'Xiaomi')],
    );

    expect(result).toMatchObject({
      status: 'FOUND',
      manufacturerKey: key,
      normalizedAlias: key,
    });
  });

  it('keeps manufacturer evidence without a registered alias unresolved', () => {
    expect(
      resolveManufacturer(
        {
          evidence: 'Unknown Device CPU 12-core GPU 16-core RAM 32GB SSD 1TB',
          matchMode: 'TEXT_BOUNDARY',
          provenance: 'EXPLICIT_SOURCE_VALIDATED',
        },
        [alias('acme', 'Acme')],
      ),
    ).toMatchObject({ status: 'MISSING' });
  });

  it('does not choose a first manufacturer when commercial text has two matches', () => {
    expect(
      resolveManufacturer(
        {
          evidence: 'Garmin bundled with Acme accessory',
          matchMode: 'TEXT_BOUNDARY',
          provenance: 'DETERMINISTIC_ALIAS',
        },
        [alias('garmin', 'Garmin'), alias('acme', 'Acme')],
      ),
    ).toMatchObject({ status: 'AMBIGUOUS', manufacturerKeys: ['acme', 'garmin'] });
  });

  it('does not grant AI any authority beyond a validated registry match', () => {
    expect(
      resolveManufacturer(
        {
          evidence: 'Unregistered Candidate',
          matchMode: 'EXACT_ALIAS',
          provenance: 'AI_CANDIDATE_VALIDATED',
        },
        [],
      ),
    ).toMatchObject({ status: 'MISSING' });
  });
});
