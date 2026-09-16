import { Inject, Injectable } from '@nestjs/common';
import { ProductCondition, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
import { PricingPrismaClient } from '../interfaces/pricing-prisma.interface';
import { normalizeProfitProductDescription } from '../providers/google-sheets-profit.provider';
export { OFFER_INCREMENT_KEY } from '../utils/offer-increment';

export const PRICING_SCOPE = 'pricing';
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

  findBrazilRadarQuote(sourceQuoteId: string) {
    return this.prisma.supplierCurrentListItem.findUnique({
      where: { id: sourceQuoteId },
      include: {
        currentList: {
          include: { supplierContact: true },
        },
      },
    });
  }

  findActiveCatalogProduct(condition: string, normalizedDescription: string) {
    return this.prisma.product.findFirst({
      where: {
        active: true,
        deletedAt: null,
        profitCondition: condition,
        normalizedDescription,
      },
      select: {
        id: true,
        profitProductId: true,
        productDescription: true,
        normalizedDescription: true,
        productType: true,
        isAppleOriginal: true,
        profitCondition: true,
      },
    });
  }

  findActiveCatalogProductById(productId: string) {
    return this.prisma.product.findFirst({
      where: {
        id: productId,
        active: true,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        profitProductId: true,
        productDescription: true,
        normalizedDescription: true,
        productType: true,
        isAppleOriginal: true,
        profitCondition: true,
        category: { select: { name: true } },
        model: { select: { name: true } },
        color: { select: { name: true } },
        storage: { select: { displayName: true } },
      },
    });
  }

  async findEligibleCatalogProductCandidates(input: {
    modelKey: string;
    capacity: string;
    condition: ProductCondition;
  }) {
    const normalizedCapacity = normalizeProfitProductDescription(input.capacity);
    if (!input.modelKey || !normalizedCapacity) return [];

    const candidates = await this.prismaService.product.findMany({
      where: {
        active: true,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
        profitCondition: input.condition,
      },
      select: {
        id: true,
        profitProductId: true,
        productDescription: true,
        normalizedDescription: true,
        productType: true,
        isAppleOriginal: true,
        profitCondition: true,
        category: { select: { name: true } },
        model: { select: { name: true, normalizedName: true } },
        color: { select: { name: true } },
        storage: { select: { displayName: true } },
      },
    });

    const matches = [];
    for (const candidate of candidates) {
      if (candidate.model.normalizedName !== input.modelKey) continue;
      if (
        !candidate.storage ||
        normalizeProfitProductDescription(candidate.storage.displayName) !== normalizedCapacity
      ) {
        continue;
      }
      matches.push(candidate);
      if (matches.length === 2) break;
    }
    return matches;
  }

  listActiveCatalogProducts(): Promise<ProductIdShadowCandidate[]> {
    return this.prisma.product.findMany({
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
