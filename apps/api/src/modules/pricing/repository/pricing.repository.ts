import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PricingPrismaClient } from '../interfaces/pricing-prisma.interface';

export const PRICING_SCOPE = 'pricing';
export const OFFER_INCREMENT_KEY = 'offer_increment';
export const MODEL_PROFIT_PREFIX = 'model_profit.';

@Injectable()
export class PricingRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listQuotes() {
    return this.prisma.priceHistory.findMany({
      include: {
        supplier: true,
        product: { include: { category: true, model: true, color: true, storage: true } },
      },
      orderBy: { quoteDate: 'desc' },
    });
  }

  listPricingConfigurations() {
    return this.prisma.systemConfiguration.findMany({
      where: {
        scope: PRICING_SCOPE,
      },
    });
  }

  upsertModelProfit(modelName: string, desiredNetProfit: number) {
    return this.prisma.systemConfiguration.upsert({
      where: {
        key_scope: {
          key: `${MODEL_PROFIT_PREFIX}${modelName}`,
          scope: PRICING_SCOPE,
        },
      },
      update: {
        value: String(desiredNetProfit),
        type: 'money',
      },
      create: {
        key: `${MODEL_PROFIT_PREFIX}${modelName}`,
        value: String(desiredNetProfit),
        type: 'money',
        scope: PRICING_SCOPE,
      },
    });
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE';
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'pricing', ...data },
    });
  }

  private get prisma(): PricingPrismaClient {
    return this.prismaService as unknown as PricingPrismaClient;
  }
}
