import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  isReservedAppleManufacturerAlias,
  normalizeManufacturerAlias,
} from '../manufacturer-alias-normalizer';
import { resolveManufacturer, type ManufacturerResolverInput } from '../manufacturer-resolver';
import { ManufacturersRepository } from '../repository/manufacturers.repository';

@Injectable()
export class ManufacturersService {
  constructor(
    @Inject(ManufacturersRepository) private readonly repository: ManufacturersRepository,
  ) {}

  async resolve(input: ManufacturerResolverInput) {
    return resolveManufacturer(input, await this.repository.listActiveAliases());
  }

  async createIdentity(input: { manufacturerKey: string; canonicalName: string }) {
    const manufacturerKey = input.manufacturerKey.trim();
    const canonicalName = input.canonicalName.trim();
    if (!manufacturerKey || !canonicalName) {
      throw new BadRequestException('Chave e nome canonico do fabricante sao obrigatorios.');
    }
    if (
      isReservedAppleManufacturerAlias(manufacturerKey) ||
      isReservedAppleManufacturerAlias(canonicalName)
    ) {
      throw new BadRequestException('Apple nao pode ser cadastrado no registry externo.');
    }
    if (await this.repository.findIdentityByKey(manufacturerKey)) {
      throw new ConflictException('manufacturerKey ja cadastrado.');
    }

    try {
      return await this.repository.createIdentity({ manufacturerKey, canonicalName });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('manufacturerKey ja cadastrado.');
      }
      throw error;
    }
  }

  async createAlias(input: { manufacturerId: string; alias: string }) {
    const alias = input.alias.trim();
    const normalizedAlias = normalizeManufacturerAlias(alias);
    if (!normalizedAlias) throw new BadRequestException('Alias do fabricante e obrigatorio.');
    if (isReservedAppleManufacturerAlias(alias)) {
      throw new BadRequestException('Apple nao pode ser cadastrado no registry externo.');
    }
    if (await this.repository.findAliasByNormalizedAlias(normalizedAlias)) {
      throw new ConflictException('Alias normalizado ja pertence a outro fabricante.');
    }

    try {
      return await this.repository.createAlias({ ...input, alias, normalizedAlias });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Alias normalizado ja pertence a outro fabricante.');
      }
      throw error;
    }
  }

  setIdentityStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.repository.setIdentityStatus(id, status);
  }
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
