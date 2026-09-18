import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { PricingRepository } from './pricing.repository';

function catalogProduct(
  id: string,
  model: string,
  capacity: string | null,
  variantAttributes: Record<string, string> | null = null,
) {
  return {
    id,
    profitProductId: 1,
    productDescription: `${model} ${capacity ?? ''}`.trim(),
    normalizedDescription: null,
    productType: 'IPHONE_SEALED',
    isAppleOriginal: true,
    profitCondition: 'NOVO',
    category: { name: 'iPhone Lacrado' },
    model: { name: model, normalizedName: model.toLowerCase().replace(/\s+/g, '-') },
    color: null,
    storage: capacity ? { displayName: capacity } : null,
    variantAttributes,
  };
}

describe('PricingRepository.findEligibleCatalogProductCandidates', () => {
  it('uses the strict eligible lifecycle and exact financial condition', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PricingRepository({ product: { findMany } } as unknown as PrismaService);

    await repository.findEligibleCatalogProductCandidates({
      modelKey: 'iphone-18-pro-max',
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
      modelKey: 'iphone-18-pro-max',
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
        modelKey: '',
        capacity: '---',
        condition: 'NOVO',
      }),
    ).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('eliminates the artificial MacBook ambiguity with applicable structured attributes', async () => {
    const compatible = catalogProduct('macbook-16gb', 'MacBook Pro', '1TB', {
      ram: '16GB',
      screen: 'Standard Display',
    });
    const incompatible = catalogProduct('macbook-8gb', 'MacBook Pro', '1TB', {
      ram: '8GB',
      screen: 'Standard Display',
    });
    const findMany = vi.fn().mockResolvedValue([compatible, incompatible]);
    const repository = new PricingRepository({ product: { findMany } } as unknown as PrismaService);

    const beforeStructuredIdentity = await repository.findEligibleCatalogProductCandidates({
      modelKey: 'macbook-pro',
      capacity: '1TB',
      condition: 'NOVO',
    });
    const result = await repository.findEligibleCatalogProductCandidates({
      modelKey: 'macbook-pro',
      capacity: '1TB',
      condition: 'NOVO',
      variantAttributes: { ram: '16GB', screen: 'Standard Display' },
    });

    expect(beforeStructuredIdentity.map((candidate) => candidate.id)).toEqual([
      'macbook-16gb',
      'macbook-8gb',
    ]);
    expect(result.map((candidate) => candidate.id)).toEqual(['macbook-16gb']);
  });

  it('preserves fail-closed behavior when structured identity cannot distinguish candidates', async () => {
    const first = catalogProduct('macbook-a', 'MacBook Pro', '1TB', {
      ram: '16GB',
      screen: 'Standard Display',
    });
    const second = catalogProduct('macbook-b', 'MacBook Pro', '1TB', {
      ram: '16GB',
      screen: 'Standard Display',
    });
    const repository = new PricingRepository({
      product: { findMany: vi.fn().mockResolvedValue([first, second]) },
    } as unknown as PrismaService);

    await expect(
      repository.findEligibleCatalogProductCandidates({
        modelKey: 'macbook-pro',
        capacity: '1TB',
        condition: 'NOVO',
        variantAttributes: { ram: '16GB', screen: 'Standard Display' },
      }),
    ).resolves.toHaveLength(2);
  });

  it('does not invent a missing structured dimension and preserves a legacy unique candidate', async () => {
    const first = catalogProduct('macbook-16gb', 'MacBook Pro', '1TB', {
      ram: '16GB',
      screen: 'Standard Display',
    });
    const second = catalogProduct('macbook-8gb', 'MacBook Pro', '1TB', {
      ram: '8GB',
      screen: 'Standard Display',
    });
    const repository = new PricingRepository({
      product: { findMany: vi.fn().mockResolvedValue([first, second]) },
    } as unknown as PrismaService);

    await expect(
      repository.findEligibleCatalogProductCandidates({
        modelKey: 'macbook-pro',
        capacity: '1TB',
        condition: 'NOVO',
      }),
    ).resolves.toHaveLength(2);

    const uniqueRepository = new PricingRepository({
      product: { findMany: vi.fn().mockResolvedValue([first]) },
    } as unknown as PrismaService);
    await expect(
      uniqueRepository.findEligibleCatalogProductCandidates({
        modelKey: 'macbook-pro',
        capacity: '1TB',
        condition: 'NOVO',
      }),
    ).resolves.toEqual([first]);
  });

  it('preserves zero compatible candidates', async () => {
    const repository = new PricingRepository({
      product: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService);

    await expect(
      repository.findEligibleCatalogProductCandidates({
        modelKey: 'macbook-pro',
        capacity: '1TB',
        condition: 'NOVO',
        variantAttributes: { ram: '16GB', screen: 'Standard Display' },
      }),
    ).resolves.toEqual([]);
  });
});
