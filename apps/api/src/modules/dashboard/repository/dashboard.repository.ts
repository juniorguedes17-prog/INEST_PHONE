import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardQueryDto } from '../dto/dashboard.dto';
import { DashboardPrismaClient } from '../interfaces/dashboard-prisma.interface';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async snapshot(query: DashboardQueryDto) {
    const dateFilter = this.getDateFilter(query);
    const [products, suppliers, quotes, offers, sales, importLogs, offerLogs] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          deletedAt: null,
          id: query.productId,
          category: query.category ? { name: query.category } : undefined,
        },
        include: { category: true, model: true, color: true, storage: true },
      }),
      this.prisma.supplier.findMany({ where: { deletedAt: null, id: query.supplierId } }),
      this.prisma.priceHistory.findMany({
        where: {
          productId: query.productId,
          supplierId: query.supplierId,
          quoteDate: dateFilter,
        },
        include: {
          product: { include: { category: true, model: true, color: true, storage: true } },
          supplier: true,
        },
      }),
      this.prisma.offer.findMany({
        where: { deletedAt: null, createdAt: dateFilter },
        include: { items: true },
      }),
      this.prisma.sale.findMany({
        where: { deletedAt: null, saleDate: dateFilter, status: 'COMPLETED' },
        include: {
          items: { include: { product: { include: { category: true, model: true } } } },
        },
      }),
      this.prisma.auditLog?.findMany({
        where: { entity: 'import_radar', createdAt: dateFilter, userId: query.userId },
        orderBy: { createdAt: 'desc' },
      }) ?? [],
      this.prisma.auditLog?.findMany({
        where: { entity: 'offers', createdAt: dateFilter, userId: query.userId },
        orderBy: { createdAt: 'desc' },
      }) ?? [],
    ]);

    return { products, suppliers, quotes, offers, sales, importLogs, offerLogs };
  }

  createAccessAudit(data: { userId?: string | null; filters: DashboardQueryDto }) {
    return this.prisma.auditLog?.create({
      data: {
        userId: data.userId,
        operationType: 'EXPORT',
        entity: 'dashboard',
        context: { event: 'dashboard.accessed', filters: data.filters },
      },
    });
  }

  private getDateFilter(query: DashboardQueryDto) {
    if (!query.startDate && !query.endDate) {
      return undefined;
    }

    return {
      gte: query.startDate ? new Date(query.startDate) : undefined,
      lte: query.endDate ? new Date(query.endDate) : undefined,
    };
  }

  private get prisma(): DashboardPrismaClient {
    return this.prismaService as unknown as DashboardPrismaClient;
  }
}
