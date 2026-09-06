import { BadRequestException } from '@nestjs/common';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { describe, expect, it } from 'vitest';
import type { ShippingWeightKeyInput } from './shipping-weight.contract';
import { deriveShippingWeightKey } from './shipping-weight-key-deriver';
import {
  ShippingWeightRepository,
  type ShippingWeightPersistenceRecord,
} from './shipping-weight.repository';
import { normalizeShippingWeightLbs, ShippingWeightService } from './shipping-weight.service';

class MemoryShippingWeightRepository {
  readonly records = new Map<string, ShippingWeightPersistenceRecord>();
  readonly audits: unknown[] = [];

  async findByShippingWeightKey(shippingWeightKey: string) {
    return this.records.get(shippingWeightKey) ?? null;
  }

  async createWeight(input: {
    shippingWeightKey: string;
    shippingWeightLbs: string;
    userId: string;
  }) {
    if (this.records.has(input.shippingWeightKey)) throw { code: 'P2002' };
    const now = new Date();
    const record: ShippingWeightPersistenceRecord = {
      id: `shipping-weight-${this.records.size + 1}`,
      shippingWeightKey: input.shippingWeightKey,
      shippingWeightLbs: { toString: () => input.shippingWeightLbs },
      createdBy: input.userId,
      updatedBy: input.userId,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(input.shippingWeightKey, record);
    return record;
  }

  async upsertWeight(input: {
    shippingWeightKey: string;
    shippingWeightLbs: string;
    userId: string;
  }) {
    const current = this.records.get(input.shippingWeightKey);
    const now = new Date();
    const record: ShippingWeightPersistenceRecord = {
      id: current?.id ?? `shipping-weight-${this.records.size + 1}`,
      shippingWeightKey: input.shippingWeightKey,
      shippingWeightLbs: { toString: () => input.shippingWeightLbs },
      createdBy: current?.createdBy ?? input.userId,
      updatedBy: input.userId,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.records.set(input.shippingWeightKey, record);
    return record;
  }

  async createAuditLog(data: unknown) {
    this.audits.push(data);
  }
}

function resolvedAppleInput(): ShippingWeightKeyInput {
  return {
    manufacturer: { status: 'RESOLVED', manufacturerKey: 'apple' },
    productIdentity: deriveExtendedProductIdentity({
      productName: 'iPhone 16 Pro 256GB',
      quality: 'NOVO',
    }),
    composition: { kind: 'SINGLE_ITEM' },
  };
}

function keyFor(input = resolvedAppleInput()) {
  const resolution = deriveShippingWeightKey(input);
  if (resolution.status !== 'KEY_RESOLVED') throw new Error('Expected a resolved key.');
  return resolution.shippingWeightKey;
}

function setup() {
  const repository = new MemoryShippingWeightRepository();
  return {
    repository,
    service: new ShippingWeightService(repository as unknown as ShippingWeightRepository),
  };
}

describe('ShippingWeightService', () => {
  it.each([
    [0.5, '0.500'],
    [0.65, '0.650'],
    [3.95, '3.950'],
    [4, '4.000'],
  ])('preserves the Decimal(8,3) shipping weight %s as %s', (value, expected) => {
    expect(normalizeShippingWeightLbs(value)).toBe(expected);
  });

  it.each([0, -0.5, Number.NaN, Number.POSITIVE_INFINITY, '0.500', 0.0001])(
    'rejects invalid operational shipping weight %s',
    (value) => {
      expect(() => normalizeShippingWeightLbs(value)).toThrow(BadRequestException);
    },
  );

  it('finds a stored weight, atomically replaces one key, and audits both writes', async () => {
    const { service, repository } = setup();
    const key = keyFor();

    await expect(service.resolveWeight(resolvedAppleInput())).resolves.toEqual({
      status: 'MISSING_WEIGHT',
      shippingWeightKey: key,
    });
    await expect(
      service.upsertWeight({ shippingWeightKey: key, shippingWeightLbs: 3.95, userId: 'user-1' }),
    ).resolves.toMatchObject({ shippingWeightLbs: 3.95, createdBy: 'user-1', updatedBy: 'user-1' });
    await expect(
      service.upsertWeight({ shippingWeightKey: key, shippingWeightLbs: 4, userId: 'user-2' }),
    ).resolves.toMatchObject({ shippingWeightLbs: 4, createdBy: 'user-1', updatedBy: 'user-2' });
    await expect(service.resolveWeight(resolvedAppleInput())).resolves.toMatchObject({
      status: 'WEIGHT_FOUND',
      shippingWeightKey: key,
      shippingWeightLbs: 4,
    });

    expect(repository.records).toHaveLength(1);
    expect(repository.audits).toHaveLength(2);
  });

  it('allows equal weights for different keys without Product linkage or kg persistence', async () => {
    const { service, repository } = setup();
    const first = keyFor();
    const second = keyFor({
      ...resolvedAppleInput(),
      productIdentity: deriveExtendedProductIdentity({
        productName: 'AirPods Max USB-C',
        quality: 'NOVO',
      }),
    });

    await service.upsertWeight({
      shippingWeightKey: first,
      shippingWeightLbs: 0.65,
      userId: 'user-1',
    });
    await service.upsertWeight({
      shippingWeightKey: second,
      shippingWeightLbs: 0.65,
      userId: 'user-1',
    });

    expect(repository.records).toHaveLength(2);
    expect([...repository.records.values()].every((record) => !('weightKg' in record))).toBe(true);
  });

  it('creates a missing weight once, is idempotent for the same concurrent value, and rejects a different one', async () => {
    const { service, repository } = setup();
    const key = keyFor();

    const sameWeight = await Promise.all([
      service.registerMissingWeight({
        shippingWeightKey: key,
        shippingWeightLbs: 3.95,
        userId: 'user-1',
      }),
      service.registerMissingWeight({
        shippingWeightKey: key,
        shippingWeightLbs: 3.95,
        userId: 'user-2',
      }),
    ]);

    expect(sameWeight.map((result) => result.outcome).sort()).toEqual(['CREATED', 'IDEMPOTENT']);
    expect(repository.records).toHaveLength(1);
    await expect(
      service.registerMissingWeight({
        shippingWeightKey: key,
        shippingWeightLbs: 4,
        userId: 'user-3',
      }),
    ).rejects.toThrow('Ja existe um peso operacional de envio diferente');
    expect(repository.records.get(key)?.shippingWeightLbs.toString()).toBe('3.950');
    expect(repository.audits).toHaveLength(1);
  });
});
