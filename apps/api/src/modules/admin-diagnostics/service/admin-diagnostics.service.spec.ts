import { describe, expect, it, vi } from 'vitest';
import { AdminDiagnosticsService } from './admin-diagnostics.service';

function product(id: string, profitProductId: number, description: string, active = true) {
  return {
    id,
    profitProductId,
    productDescription: description,
    active,
    status: active ? 'ACTIVE' : 'INACTIVE',
    deletedAt: active ? null : new Date('2026-01-01T00:00:00.000Z'),
    productType: 'APPLE_WATCH',
    profitCondition: 'NOVO',
    category: { name: 'Apple Watch' },
    model: { name: description },
    color: null,
    storage: null,
  };
}

describe('AdminDiagnosticsService', () => {
  it('produces a structured read-only audit without write methods', async () => {
    const id61 = product('uuid-61', 61, 'Apple Watch Series 11 42mm GPS');
    const id62 = product('uuid-62', 62, 'Apple Watch Series 11 46mm GPS');
    const id67 = product('uuid-67', 67, 'Apple Watch Ultra 3 2024', false);
    const activeProducts = [id61, id62];
    const productsByProfitId = new Map([[61, id61], [62, id62], [67, id67]]);
    const prisma = {
      product: {
        count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(2),
        findMany: vi.fn().mockResolvedValue(activeProducts),
        findUnique: vi.fn(({ where }: { where: { profitProductId: number } }) =>
          Promise.resolve(productsByProfitId.get(where.profitProductId) ?? null),
        ),
      },
    };

    const result = await new AdminDiagnosticsService(prisma as never).readiness();

    expect(result.productsTotal).toBe(3);
    expect(result.productsActive).toBe(2);
    expect(result.checks.id61).toMatchObject({ pass: true, canonicalModelKey: 'apple-watch-series-11-42' });
    expect(result.checks.id62).toMatchObject({ pass: true, canonicalModelKey: 'apple-watch-series-11-46' });
    expect(result.checks.id67).toMatchObject({ participatesInActive: false });
    expect(prisma.product).not.toHaveProperty('create');
    expect(prisma.product).not.toHaveProperty('update');
    expect(prisma.product).not.toHaveProperty('delete');
  });
});
