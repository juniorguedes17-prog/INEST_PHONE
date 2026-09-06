import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type { ManufacturerResolution } from '../../manufacturers/manufacturer-resolver';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { ShippingWeightPersistenceRecord } from './shipping-weight.repository';
import { ShippingWeightRepository } from './shipping-weight.repository';
import type {
  RegisterShippingWeightDto,
  ResolveShippingWeightDto,
} from './shipping-weight-registration.dto';
import { ShippingWeightRegistrationService } from './shipping-weight-registration.service';
import { ShippingWeightService } from './shipping-weight.service';

class MemoryShippingWeightRepository {
  readonly records = new Map<string, ShippingWeightPersistenceRecord>();
  readonly audits: unknown[] = [];

  async findByShippingWeightKey(key: string) {
    return this.records.get(key) ?? null;
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
    const existing = this.records.get(input.shippingWeightKey);
    if (existing) {
      existing.shippingWeightLbs = { toString: () => input.shippingWeightLbs };
      existing.updatedBy = input.userId;
      return existing;
    }
    return this.createWeight(input);
  }

  async createAuditLog(data: unknown) {
    this.audits.push(data);
  }
}

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  role: 'Operador',
  permissions: ['products:edit'],
};

function dto(
  overrides: Partial<RegisterShippingWeightDto['sourceProduct']> = {},
): RegisterShippingWeightDto {
  return {
    shippingWeightLbs: 3.95,
    composition: { kind: 'SINGLE_ITEM' },
    sourceProduct: {
      sourceProductId: 'external-iphone-16',
      sourceName: 'iPhone 16 Pro 256GB',
      supplier: 'Store USA',
      sourceUrl: 'https://example.com/iphone-16-pro',
      origin: 'US',
      condition: 'NOVO',
      ...overrides,
    },
  };
}

function setup(manufacturerResolution?: ManufacturerResolution) {
  const repository = new MemoryShippingWeightRepository();
  const shippingWeightService = new ShippingWeightService(
    repository as unknown as ShippingWeightRepository,
  );
  const manufacturers = {
    resolve: async () =>
      manufacturerResolution ?? ({ status: 'MISSING', normalizedEvidence: '' } as const),
  };
  return {
    repository,
    service: new ShippingWeightRegistrationService(
      shippingWeightService,
      manufacturers as unknown as ManufacturersService,
    ),
  };
}

describe('ShippingWeightRegistrationService', () => {
  it('returns MISSING_WEIGHT read-only for a resolved identity without a record', async () => {
    const { service, repository } = setup();

    await expect(service.resolve(dto())).resolves.toEqual({ status: 'MISSING_WEIGHT' });
    expect(repository.records).toHaveLength(0);
    expect(repository.audits).toHaveLength(0);
  });

  it.each([
    [0.5, 0.5],
    [0.65, 0.65],
    [3.95, 3.95],
  ])('hands off an existing shipping weight %s without writes', async (weight, expected) => {
    const { service, repository } = setup();
    await service.register({ ...dto(), shippingWeightLbs: weight }, user);
    const recordsBeforeRead = repository.records.size;
    const auditsBeforeRead = repository.audits.length;

    await expect(service.resolve(dto())).resolves.toEqual({
      status: 'WEIGHT_FOUND',
      shippingWeightLbs: expected,
    });
    expect(repository.records).toHaveLength(recordsBeforeRead);
    expect(repository.audits).toHaveLength(auditsBeforeRead);
  });

  it('performs the READ → WRITE → READ handoff without exposing or accepting a key', async () => {
    const { service, repository } = setup();
    const firstSource = dto({ sourceName: 'iPhone 16 128GB' });
    const secondSource: ResolveShippingWeightDto = {
      ...dto({
        sourceProductId: 'same-identity-other-source',
        sourceName: 'iPhone 16 128GB',
        supplier: 'Other Store',
        origin: 'PY',
      }),
    };

    await expect(service.resolve(firstSource)).resolves.toEqual({ status: 'MISSING_WEIGHT' });
    await expect(
      service.register({ ...firstSource, shippingWeightLbs: 2 }, user),
    ).resolves.toMatchObject({
      status: 'WEIGHT_FOUND',
      registration: 'CREATED',
      shippingWeightLbs: 2,
    });
    await expect(service.resolve(secondSource)).resolves.toEqual({
      status: 'WEIGHT_FOUND',
      shippingWeightLbs: 2,
    });
    await expect(
      service.resolve(dto({ sourceName: 'iPhone 16 256GB', sourceProductId: 'other-storage' })),
    ).resolves.toEqual({ status: 'MISSING_WEIGHT' });
    expect(repository.records).toHaveLength(1);
  });

  it('keeps insufficient and ambiguous identity decisions read-only', async () => {
    const insufficient = setup();
    await expect(
      insufficient.service.resolve(dto({ sourceName: 'iPhone 16 Pro' })),
    ).resolves.toMatchObject({ status: 'KEY_INSUFFICIENT' });
    expect(insufficient.repository.records).toHaveLength(0);
    expect(insufficient.repository.audits).toHaveLength(0);

    const ambiguous = setup();
    await expect(
      ambiguous.service.resolve(
        dto({ sourceName: 'iPhone 16 Pro 256GB Apple Watch Series 11 46mm' }),
      ),
    ).resolves.toEqual({ status: 'KEY_AMBIGUOUS', ambiguousSources: ['product_identity'] });
    expect(ambiguous.repository.records).toHaveLength(0);
    expect(ambiguous.repository.audits).toHaveLength(0);
  });

  it('derives a US Apple key server-side and persists a missing weight without Product.id', async () => {
    const { service, repository } = setup();
    const result = await service.register(dto(), user);

    expect(result).toMatchObject({
      status: 'WEIGHT_FOUND',
      registration: 'CREATED',
      shippingWeightLbs: 3.95,
    });
    expect(repository.records).toHaveLength(1);
    const [key] = repository.records.keys();
    expect(key).toContain('shipping:v1|manufacturer=apple|family=iphone|model=iphone-16-pro');
    expect(repository.audits).toHaveLength(1);
    expect(repository.audits[0]).toMatchObject({
      context: { origin: 'US', sourceProductId: 'external-iphone-16' },
    });
  });

  it('returns WEIGHT_FOUND idempotently for the same value and conflicts for a different value', async () => {
    const { service, repository } = setup();
    await service.register(dto(), user);

    await expect(service.register(dto(), { ...user, id: 'user-2' })).resolves.toMatchObject({
      status: 'WEIGHT_FOUND',
      registration: 'IDEMPOTENT',
    });
    await expect(service.register({ ...dto(), shippingWeightLbs: 4 }, user)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.records).toHaveLength(1);
    expect(repository.audits).toHaveLength(1);
  });

  it.each([
    [0.5, '0.500'],
    [0.65, '0.650'],
    [3.95, '3.950'],
  ])('preserves confirmed weight %s as Decimal(8,3) %s', async (weight, stored) => {
    const { service, repository } = setup();
    await service.register({ ...dto(), shippingWeightLbs: weight }, user);
    expect([...repository.records.values()][0]?.shippingWeightLbs.toString()).toBe(stored);
  });

  it.each([0, -1, 0.0001])('rejects invalid confirmed weight %s', async (shippingWeightLbs) => {
    const { service } = setup();
    await expect(service.register({ ...dto(), shippingWeightLbs }, user)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects insufficient and ambiguous identities without persistence', async () => {
    const insufficient = setup();
    await expect(
      insufficient.service.register(dto({ sourceName: 'iPhone 16 Pro' }), user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insufficient.repository.records).toHaveLength(0);

    const ambiguous = setup();
    await expect(
      ambiguous.service.register(
        dto({ sourceName: 'iPhone 16 Pro 256GB Apple Watch Series 11 46mm' }),
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ambiguous.repository.records).toHaveLength(0);
  });

  it('keeps Non-Apple manufacturer resolution fail-closed without a canonical logistics identity', async () => {
    const { service, repository } = setup({
      status: 'FOUND',
      manufacturerId: 'manufacturer-1',
      manufacturerKey: 'garmin',
      canonicalName: 'Garmin',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
      normalizedEvidence: 'garmin',
      matchedAlias: 'Garmin',
      normalizedAlias: 'garmin',
    });

    await expect(
      service.register(
        dto({
          sourceName: 'Garmin Vivoactive 6',
          sourceManufacturer: 'Garmin',
          sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        }),
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.records).toHaveLength(0);
  });

  it('keeps resolved Non-Apple manufacturer identity insufficient during read-only resolution', async () => {
    const { service, repository } = setup({
      status: 'FOUND',
      manufacturerId: 'manufacturer-1',
      manufacturerKey: 'canon',
      canonicalName: 'Canon',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
      normalizedEvidence: 'canon',
      matchedAlias: 'Canon',
      normalizedAlias: 'canon',
    });

    await expect(
      service.resolve(
        dto({
          sourceName: 'Canon EOS Rebel T7',
          sourceManufacturer: 'Canon',
          sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
        }),
      ),
    ).resolves.toMatchObject({ status: 'KEY_INSUFFICIENT' });
    expect(repository.records).toHaveLength(0);
    expect(repository.audits).toHaveLength(0);
  });
});
