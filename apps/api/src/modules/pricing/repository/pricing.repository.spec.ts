import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { PricingRepository } from './pricing.repository';

function catalogProduct(id: string, model: string, capacity: string | null) {
  return {
    id,
    profitProductId: 1,
    productDescription: `${model} ${capacity ?? ''}`.trim(),
    normalizedDescription: null,
    productType: 'IPHONE_SEALED',
    isAppleOriginal: true,
    profitCondition: 'NOVO',
    category: { name: 'iPhone Lacrado' },
    model: { name: model },
    color: null,
    storage: capacity ? { displayName: capacity } : null,
  };
}

describe('PricingRepository.findEligibleCatalogProductCandidates', () => {
  it('uses the strict eligible lifecycle and exact financial condition', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PricingRepository({ product: { findMany } } as unknown as PrismaService);

    await repository.findEligibleCatalogProductCandidates({
      model: 'iPhone 18 Pro Max',
      capacity: '256GB',
      condition: 'NOVO',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          active: true,
          status: 'ACTIVE',
          deletedAt: null,
          profitCondition: 'NOVO',
        },
      }),
    );
  });

  it('matches normalized model and storage exactly and returns at most two matches', async () => {
    const matchingA = catalogProduct('matching-a', 'iPhone 18 Pro Max', '256 GB');
    const wrongStorage = catalogProduct('wrong-storage', 'iPhone 18 Pro Max', '512GB');
    const wrongModel = catalogProduct('wrong-model', 'iPhone 18 Pro', '256GB');
    const matchingB = catalogProduct('matching-b', 'IPHONE 18 PRO MAX', '256GB');
    const matchingC = catalogProduct('matching-c', 'iPhone 18 Pro Max', '256 GB');
    const findMany = vi
      .fn()
      .mockResolvedValue([matchingA, wrongStorage, wrongModel, matchingB, matchingC]);
    const repository = new PricingRepository({ product: { findMany } } as unknown as PrismaService);

    const result = await repository.findEligibleCatalogProductCandidates({
      model: '  iPhone 18 Pro Max ',
      capacity: '256GB',
      condition: 'NOVO',
    });

    expect(result.map((candidate) => candidate.id)).toEqual(['matching-a', 'matching-b']);
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('orderBy');
  });

  it('does not query the catalog when model or storage has no normalized identity', async () => {
    const findMany = vi.fn();
    const repository = new PricingRepository({ product: { findMany } } as unknown as PrismaService);

    await expect(
      repository.findEligibleCatalogProductCandidates({
        model: '---',
        capacity: '---',
        condition: 'NOVO',
      }),
    ).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
