import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePriceQuoteDto,
  PriceRadarQueryDto,
  UpdatePriceQuoteDto,
} from '../dto/price-radar.dto';
import {
  PriceQuoteRecord,
  PriceRadarPrismaClient,
} from '../interfaces/price-radar-prisma.interface';
import { markHidden } from '../validators/price-radar.validators';

@Injectable()
export class PriceRadarRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listQuotes(query: PriceRadarQueryDto) {
    return this.prisma.priceHistory.findMany({
      where: {
        productId: query.productId,
        supplierId: query.supplierId,
        city: query.city ? { contains: query.city, mode: 'insensitive' } : undefined,
        deliveryTime: query.deliveryTime
          ? { contains: query.deliveryTime, mode: 'insensitive' }
          : undefined,
        OR: query.search
          ? [
              { supplier: { name: { contains: query.search, mode: 'insensitive' } } },
              { product: { model: { name: { contains: query.search, mode: 'insensitive' } } } },
              {
                product: {
                  category: { name: { contains: query.search, mode: 'insensitive' } },
                },
              },
              { product: { color: { name: { contains: query.search, mode: 'insensitive' } } } },
              {
                product: {
                  storage: { displayName: { contains: query.search, mode: 'insensitive' } },
                },
              },
              { city: { contains: query.search, mode: 'insensitive' } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: this.include,
      orderBy:
        query.sort === 'lowest_price'
          ? { costProduct: 'asc' }
          : query.sort === 'highest_price'
            ? { costProduct: 'desc' }
            : { quoteDate: 'desc' },
    });
  }

  findQuote(id: string) {
    return this.prisma.priceHistory.findUnique({
      where: { id },
      include: this.include,
    });
  }

  createQuote(dto: CreatePriceQuoteDto, importBatchId?: string) {
    return this.prisma.priceHistory.create({
      data: {
        productId: dto.productId,
        supplierId: dto.supplierId,
        importBatchId,
        costProduct: dto.costProduct,
        deliveryTime: dto.deliveryTime,
        city: dto.city,
        contact: dto.contact,
        notes: this.composeNotes(dto.quality, dto.notes),
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : new Date(),
      },
      include: this.include,
    });
  }

  updateQuote(id: string, dto: UpdatePriceQuoteDto) {
    return this.prisma.priceHistory.update({
      where: { id },
      data: {
        productId: dto.productId,
        supplierId: dto.supplierId,
        costProduct: dto.costProduct,
        deliveryTime: dto.deliveryTime,
        city: dto.city,
        contact: dto.contact,
        notes: this.composeNotes(dto.quality, dto.notes),
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : undefined,
      },
      include: this.include,
    });
  }

  async hideQuote(id: string) {
    const quote = await this.findQuote(id);
    return this.prisma.priceHistory.update({
      where: { id },
      data: { notes: markHidden(quote?.notes) },
      include: this.include,
    });
  }

  findProduct(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  findSupplier(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  createImportBatch(data: {
    userId?: string | null;
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    messages: unknown[];
  }) {
    return this.prisma.importBatch.create({
      data: {
        source: 'CSV',
        status: data.invalidRecords ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        totalRecords: data.totalRecords,
        validRecords: data.validRecords,
        invalidRecords: data.invalidRecords,
        inconsistencyMessages: JSON.stringify(data.messages),
        user: data.userId ? { connect: { id: data.userId } } : undefined,
      },
    });
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';
    entityId?: string | null;
    oldValue?: PriceQuoteRecord | null;
    newValue?: PriceQuoteRecord | null;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'price_radar', ...data },
    });
  }

  private composeNotes(quality?: string, notes?: string) {
    return [quality ? `Qualidade: ${quality}` : null, notes].filter(Boolean).join(' | ') || null;
  }

  private get include() {
    return {
      supplier: true,
      product: { include: { category: true, model: true, color: true, storage: true } },
    };
  }

  private get prisma(): PriceRadarPrismaClient {
    return this.prismaService as unknown as PriceRadarPrismaClient;
  }
}
