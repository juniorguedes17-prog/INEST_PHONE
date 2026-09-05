import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { normalizeManufacturerAlias } from '../manufacturer-alias-normalizer';
import type { ManufacturerResolverAlias } from '../manufacturer-resolver';
import { ManufacturersRepository } from '../repository/manufacturers.repository';
import { ManufacturersService } from './manufacturers.service';

type Identity = {
  id: string;
  manufacturerKey: string;
  canonicalName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
};

class MemoryManufacturersRepository {
  readonly identities: Identity[] = [];
  readonly aliases: ManufacturerResolverAlias[] = [];

  async listActiveAliases() {
    return this.aliases.filter((entry) => entry.manufacturer.status === 'ACTIVE');
  }

  async findIdentityByKey(manufacturerKey: string) {
    return this.identities.find((entry) => entry.manufacturerKey === manufacturerKey) ?? null;
  }

  async createIdentity(input: { manufacturerKey: string; canonicalName: string }) {
    if (await this.findIdentityByKey(input.manufacturerKey)) {
      throw { code: 'P2002' };
    }
    const record: Identity = {
      id: `manufacturer-${this.identities.length + 1}`,
      ...input,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.identities.push(record);
    return record;
  }

  async setIdentityStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    const identity = this.identities.find((entry) => entry.id === id);
    if (!identity) throw new Error('not found');
    identity.status = status;
    identity.updatedAt = new Date();
    for (const entry of this.aliases) {
      if (entry.manufacturer.id === id) entry.manufacturer.status = status;
    }
    return identity;
  }

  async findAliasByNormalizedAlias(normalizedAlias: string) {
    return this.aliases.find((entry) => entry.normalizedAlias === normalizedAlias) ?? null;
  }

  async createAlias(input: { manufacturerId: string; alias: string; normalizedAlias: string }) {
    if (await this.findAliasByNormalizedAlias(input.normalizedAlias)) throw { code: 'P2002' };
    const identity = this.identities.find((entry) => entry.id === input.manufacturerId);
    if (!identity) throw new Error('manufacturer not found');
    const record: ManufacturerResolverAlias = {
      id: `alias-${this.aliases.length + 1}`,
      alias: input.alias,
      normalizedAlias: input.normalizedAlias,
      manufacturer: identity,
    };
    this.aliases.push(record);
    return record;
  }
}

function setup() {
  const repository = new MemoryManufacturersRepository();
  return {
    repository,
    service: new ManufacturersService(repository as unknown as ManufacturersRepository),
  };
}

describe('ManufacturersService', () => {
  it('keeps manufacturerKey unique and canonicalName unchanged', async () => {
    const { service } = setup();
    const created = await service.createIdentity({
      manufacturerKey: 'acme-industries',
      canonicalName: 'Acme Industries Ltd.',
    });

    expect(created).toMatchObject({
      manufacturerKey: 'acme-industries',
      canonicalName: 'Acme Industries Ltd.',
      status: 'ACTIVE',
    });
    await expect(
      service.createIdentity({ manufacturerKey: 'acme-industries', canonicalName: 'Another Acme' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('can deactivate an identity without deleting it', async () => {
    const { service } = setup();
    const created = await service.createIdentity({
      manufacturerKey: 'acme',
      canonicalName: 'Acme',
    });

    await expect(service.setIdentityStatus(created.id, 'INACTIVE')).resolves.toMatchObject({
      id: created.id,
      status: 'INACTIVE',
    });
  });

  it('rejects Apple as an external manufacturer and alias', async () => {
    const { service } = setup();
    await expect(
      service.createIdentity({ manufacturerKey: 'apple', canonicalName: 'Apple Inc.' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const created = await service.createIdentity({
      manufacturerKey: 'acme',
      canonicalName: 'Acme',
    });
    await expect(
      service.createAlias({ manufacturerId: created.id, alias: 'Apple' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates one globally unique normalized alias and rejects collisions before persistence', async () => {
    const { service, repository } = setup();
    const acme = await service.createIdentity({ manufacturerKey: 'acme', canonicalName: 'Acme' });
    const orbit = await service.createIdentity({
      manufacturerKey: 'orbit',
      canonicalName: 'Orbit',
    });

    const created = await service.createAlias({ manufacturerId: acme.id, alias: 'Ácme, Inc.' });
    expect(created.normalizedAlias).toBe(normalizeManufacturerAlias('acme inc'));
    await expect(
      service.createAlias({ manufacturerId: orbit.id, alias: 'acme inc' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.aliases).toHaveLength(1);
  });
});
