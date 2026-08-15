import { Injectable } from '@nestjs/common';
import { ProductCondition } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProfitCondition,
  ProfitSheetCatalog,
  ProfitSheetRecord,
} from '../interfaces/profit-sheet.interface';

@Injectable()
export class ProductProfitProvider {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(): Promise<ProfitSheetCatalog> {
    const products = await this.prisma.product.findMany({
      where: {
        profitProductId: { not: null },
        productDescription: { not: null },
        normalizedDescription: { not: null },
        profitCondition: { not: null },
        netProfit: { not: null },
        active: true,
        deletedAt: null,
      },
      select: {
        profitProductId: true,
        profitCondition: true,
        productDescription: true,
        normalizedDescription: true,
        netProfit: true,
      },
      orderBy: { profitProductId: 'asc' },
    });

    const records: ProfitSheetRecord[] = [];
    for (const product of products) {
      if (
        product.profitProductId === null ||
        product.profitCondition === null ||
        product.productDescription === null ||
        product.normalizedDescription === null ||
        product.netProfit === null
      ) {
        continue;
      }

      records.push({
        productId: String(product.profitProductId),
        condition: mapProfitCondition(product.profitCondition),
        productDescription: product.productDescription,
        normalizedDescription: product.normalizedDescription,
        netProfit: Number(product.netProfit),
      });
    }

    return { records, fetchedAt: new Date().toISOString() };
  }

  async refresh(): Promise<ProfitSheetCatalog> {
    return this.getCatalog();
  }
}

function mapProfitCondition(condition: ProductCondition): ProfitCondition {
  if (condition === ProductCondition.SEMINOVO) return 'SEMINOVO';
  if (condition === ProductCondition.CPO) return 'CPO';
  return 'NOVO';
}
