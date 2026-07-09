import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface IntegrationsPrismaClient {
  auditLog?: {
    create(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<unknown[]>;
  };
  systemConfiguration: {
    findMany(
      args?: unknown,
    ): Promise<Array<{ key: string; value: string; type: string; scope?: string | null }>>;
    upsert(args: unknown): Promise<unknown>;
  };
}

@Injectable()
export class IntegrationsRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listConfigurations() {
    return this.prisma.systemConfiguration.findMany({
      where: { scope: 'integrations' },
    });
  }

  upsertConfiguration(key: string, value: string, type = 'texto') {
    return this.prisma.systemConfiguration.upsert({
      where: { key_scope: { key, scope: 'integrations' } },
      update: { value, type },
      create: { key, value, type, scope: 'integrations' },
    });
  }

  listHistory() {
    return (
      this.prisma.auditLog?.findMany({
        where: { entity: 'integrations' },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }) ?? Promise.resolve([])
    );
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'IMPORT' | 'EXPORT' | 'UPDATE' | 'ERROR';
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'integrations', ...data },
    });
  }

  private get prisma(): IntegrationsPrismaClient {
    return this.prismaService as unknown as IntegrationsPrismaClient;
  }
}
