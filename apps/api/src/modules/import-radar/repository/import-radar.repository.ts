import { Inject, Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';

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

  listActiveCatalogProducts(): Promise<ProductIdShadowCandidate[]> {
    return this.prismaService.product.findMany({
      where: { active: true, status: ProductStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        productDescription: true,
        productType: true,
        profitCondition: true,
        variantAttributes: true,
        category: { select: { name: true } },
        model: { select: { name: true } },
        color: { select: { name: true } },
        storage: { select: { displayName: true, value: true, unit: true } },
      },
    });
  }

  private get prisma(): ImportRadarPrismaClient {
    return this.prismaService as unknown as ImportRadarPrismaClient;
  }
}
