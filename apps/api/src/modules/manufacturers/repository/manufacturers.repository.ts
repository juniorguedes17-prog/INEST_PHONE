import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ManufacturerResolverAlias } from '../manufacturer-resolver';
import type {
  ManufacturerIdentityRecord,
  ManufacturersPrismaClient,
} from '../interfaces/manufacturers-prisma.interface';

@Injectable()
export class ManufacturersRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listActiveIdentities(): Promise<ManufacturerIdentityRecord[]> {
    return this.prisma.manufacturerIdentity.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { canonicalName: 'asc' },
    });
  }

  findIdentityByKey(manufacturerKey: string): Promise<ManufacturerIdentityRecord | null> {
    return this.prisma.manufacturerIdentity.findUnique({ where: { manufacturerKey } });
  }

  createIdentity(input: { manufacturerKey: string; canonicalName: string }) {
    return this.prisma.manufacturerIdentity.create({ data: input });
  }

  setIdentityStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
    return this.prisma.manufacturerIdentity.update({ where: { id }, data: { status } });
  }

  listActiveAliases(): Promise<ManufacturerResolverAlias[]> {
    return this.prisma.manufacturerAlias.findMany({
      where: { manufacturer: { status: 'ACTIVE' } },
      include: { manufacturer: true },
      orderBy: { normalizedAlias: 'asc' },
    });
  }

  findAliasByNormalizedAlias(normalizedAlias: string): Promise<ManufacturerResolverAlias | null> {
    return this.prisma.manufacturerAlias.findUnique({
      where: { normalizedAlias },
      include: { manufacturer: true },
    });
  }

  createAlias(input: { manufacturerId: string; alias: string; normalizedAlias: string }) {
    return this.prisma.manufacturerAlias.create({ data: input, include: { manufacturer: true } });
  }

  createAuditLog(data: {
    userId: string;
    operationType: 'CREATE' | 'UPDATE';
    entityId: string;
    oldValue?: unknown;
    newValue: unknown;
    context: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'manufacturer_identity', ...data },
    });
  }

  private get prisma(): ManufacturersPrismaClient {
    return this.prismaService as unknown as ManufacturersPrismaClient;
  }
}
