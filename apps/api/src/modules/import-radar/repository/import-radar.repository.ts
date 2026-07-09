import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface ImportRadarPrismaClient {
  auditLog?: {
    create(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<unknown[]>;
  };
}

@Injectable()
export class ImportRadarRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE' | 'IMPORT';
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'import_radar', ...data },
    });
  }

  listHistory() {
    return this.prisma.auditLog?.findMany({
      where: { entity: 'import_radar' },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  private get prisma(): ImportRadarPrismaClient {
    return this.prismaService as unknown as ImportRadarPrismaClient;
  }
}
