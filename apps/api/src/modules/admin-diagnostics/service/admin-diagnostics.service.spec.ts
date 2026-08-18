import { ConflictException } from '@nestjs/common';
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

function variantProduct(description: string, variantAttributes: unknown = null) {
  return {
    id: 'variant-product',
    profitProductId: 200,
    productDescription: description,
    active: true,
    status: 'ACTIVE',
    deletedAt: null,
    productType: 'MACBOOK',
    profitCondition: 'NOVO',
    variantAttributes,
    category: { name: 'MacBook' },
    model: { name: 'MacBook Neo' },
    color: null,
    storage: { displayName: '256GB', value: '256', unit: 'GB' },
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

  it('runs VM1 dry-run without writing and blocks an unsafe apply', async () => {
    const unsafe = variantProduct('Produto desconhecido 256GB');
    const update = vi.fn();
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([unsafe]),
        update,
      },
    };
    const service = new AdminDiagnosticsService(prisma as never);

    const dryRun = await service.variantAttributesDryRun();
    expect(dryRun.readyToApply).toBe(false);
    expect(dryRun.review).toBe(1);
    expect(dryRun.reviewItems).toEqual([{
      productId: unsafe.id,
      profitProductId: unsafe.profitProductId,
      productDescription: unsafe.productDescription,
      family: unsafe.productType,
      reason: 'identidade_insuficiente',
      currentVariantAttributes: null,
    }]);
    expect(update).not.toHaveBeenCalled();
    await expect(service.applyVariantAttributes()).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('applies only variantAttributes after the internal dry-run is safe', async () => {
    const valid = variantProduct('MacBook Neo A18 Pro 13" 8GB/256GB');
    const update = vi.fn().mockResolvedValue(valid);
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([valid]),
        update,
      },
    };
    const service = new AdminDiagnosticsService(prisma as never);

    const result = await service.applyVariantAttributes();

    expect(result).toMatchObject({ applied: true, productsUpdated: 1, review: 0, blocked: 0, collisions: 0 });
    expect(update).toHaveBeenCalledWith({
      where: { id: valid.id },
      data: { variantAttributes: { chip: 'A18 Pro', chipVariant: 'pro', screen: '13"', ram: '8GB' } },
    });
  });

  it('keeps VM1 status read-only', async () => {
    const valid = variantProduct('MacBook Neo A18 Pro 13" 8GB/256GB', {
      chip: 'A18 Pro',
      chipVariant: 'pro',
      screen: '13"',
      ram: '8GB',
    });
    const update = vi.fn();
    const prisma = { product: { findMany: vi.fn().mockResolvedValue([valid]), update } };
    const service = new AdminDiagnosticsService(prisma as never);

    const result = await service.variantAttributesStatus();

    expect(result.productsActive).toBe(1);
    expect(result.withVariantAttributes).toBe(1);
    expect(result.withoutVariantAttributes).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});
