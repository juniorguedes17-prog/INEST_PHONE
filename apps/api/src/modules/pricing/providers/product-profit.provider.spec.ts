import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductProfitProvider } from './product-profit.provider';

describe('ProductProfitProvider', () => {
  it('reads only active native products and preserves the stored monetary value', async () => {
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            profitProductId: 1,
            profitCondition: 'NOVO',
            productDescription: 'MacBook Air M5 13 16GB/512GB',
            normalizedDescription: 'macbook air m5 13 16gb 512gb',
            netProfit: 1090,
          },
        ]),
      },
    };
    const provider = new ProductProfitProvider(prisma as unknown as PrismaService);

    const catalog = await provider.getCatalog();

    expect(catalog.records).toEqual([
      {
        productId: '1',
        condition: 'NOVO',
        productDescription: 'MacBook Air M5 13 16GB/512GB',
        normalizedDescription: 'macbook air m5 13 16gb 512gb',
        netProfit: 1090,
      },
    ]);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true, deletedAt: null }),
      }),
    );
  });
});
