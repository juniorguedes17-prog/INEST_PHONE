import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePriceQuoteDto,
  PriceRadarQueryDto,
  UpdatePriceQuoteDto,
} from '../dto/price-radar.dto';
import {
  PriceQuoteRecord,
  AutomatedPriceQuoteRecord,
  PriceRadarPrismaClient,
} from '../interfaces/price-radar-prisma.interface';
import { markHidden } from '../validators/price-radar.validators';

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const AUTOMATED_LIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function automatedListFreshnessFilter(now = new Date()) {
  const normalWindow = { receivedAt: { gt: new Date(now.getTime() - AUTOMATED_LIST_MAX_AGE_MS) } };
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    weekday: 'short',
  }).format(now);

  if (weekday !== 'Sun' && weekday !== 'Mon') {
    return normalWindow;
  }

  const localDate = calendarDateInTimeZone(now, SAO_PAULO_TIME_ZONE);
  localDate.setUTCDate(localDate.getUTCDate() - (weekday === 'Sun' ? 1 : 2));
  const saturdayStart = localMidnightInTimeZone(localDate, SAO_PAULO_TIME_ZONE);
  const sundayDate = new Date(localDate);
  sundayDate.setUTCDate(sundayDate.getUTCDate() + 1);

  return {
    OR: [
      normalWindow,
      {
        receivedAt: {
          gte: saturdayStart,
          lt: localMidnightInTimeZone(sundayDate, SAO_PAULO_TIME_ZONE),
        },
      },
    ],
  };
}

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

  listAutomatedQuotes(
    query: PriceRadarQueryDto,
    now = new Date(),
  ): Promise<AutomatedPriceQuoteRecord[]> {
    return this.prisma.supplierCurrentListItem.findMany({
      where: {
        currentList: {
          supplierContact: {
            isActive: true,
          },
          ...automatedListFreshnessFilter(now),
        },
        OR: query.search
          ? [
              { productName: { contains: query.search, mode: 'insensitive' } },
              { category: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
              { color: { contains: query.search, mode: 'insensitive' } },
              { capacity: { contains: query.search, mode: 'insensitive' } },
              {
                currentList: {
                  supplierContact: {
                    supplierName: { contains: query.search, mode: 'insensitive' },
                  },
                },
              },
            ]
          : undefined,
      },
      include: {
        product: {
          select: {
            id: true,
            productDescription: true,
          },
        },
        currentList: {
          include: { supplierContact: true },
        },
      },
      orderBy:
        query.sort === 'lowest_price'
          ? { price: 'asc' }
          : query.sort === 'highest_price'
            ? { price: 'desc' }
            : { createdAt: 'desc' },
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

function calendarDateInTimeZone(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(get('year'), get('month') - 1, get('day')));
}

function localMidnightInTimeZone(localDate: Date, timeZone: string) {
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();
  let instant = Date.UTC(year, month, day);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const displayedAsUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    instant = Date.UTC(year, month, day) - (displayedAsUtc - instant);
  }

  return new Date(instant);
}
