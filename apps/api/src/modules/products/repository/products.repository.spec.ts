import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from '../dto/product.dto';
import { ProductsRepository } from './products.repository';

const dto: CreateProductDto = {
  categoryId: 'category-1',
  modelId: 'model-1',
  productType: 'IPHONE_SEALED',
  productDescription: 'iPhone 17 Pro Max 256GB',
  profitCondition: 'NOVO',
  netProfit: 590,
};

describe('ProductsRepository manual catalog persistence', () => {
  it('persists the native profit fields and normalized description on creation', async () => {
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
        create: vi.fn().mockResolvedValue({ id: 'product-133' }),
      },
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await repository.createProduct(dto, 'user-1');

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profitProductId: 133,
          productDescription: dto.productDescription,
          normalizedDescription: 'iphone 17 pro max 256gb',
          profitCondition: 'NOVO',
          netProfit: 590,
          active: true,
        }),
      }),
    );
  });

  it.each([true, false, null])(
    'persists Apple originality as the explicit tri-state value %s',
    async (isAppleOriginal) => {
      const prisma = {
        product: {
          findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
          create: vi.fn().mockResolvedValue({ id: 'product-133', isAppleOriginal }),
        },
      };
      const repository = new ProductsRepository(prisma as unknown as PrismaService);

      await repository.createProduct({ ...dto, isAppleOriginal }, 'user-1');

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isAppleOriginal }),
        }),
      );
    },
  );

  it('does not derive Apple originality from ProductType when classification is absent', async () => {
    const prisma = {
      product: {
        findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
        create: vi.fn().mockResolvedValue({ id: 'product-133' }),
      },
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await repository.createProduct(dto, 'user-1');

    const call = prisma.product.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('isAppleOriginal');
  });

  it('keeps the existing soft delete and activation semantics aligned with active', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'product-1' });
    const prisma = { product: { update } };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await repository.softDeleteProduct('product-1', 'user-1');
    await repository.setStatus('product-1', 'INACTIVE', 'user-1');
    await repository.setStatus('product-1', 'ACTIVE', 'user-1');

    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INACTIVE', active: false }),
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'INACTIVE', active: false }),
      }),
    );
    expect(update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', active: true }),
      }),
    );
  });

  it.each([true, false])(
    'restores lifecycle atomically and preserves classification %s and financial identity',
    async (isAppleOriginal) => {
      const deletedAt = new Date('2026-09-15T12:00:00.000Z');
      const historical = {
        id: 'product-1',
        ...dto,
        normalizedDescription: 'iphone 17 pro max 256gb',
        profitProductId: 133,
        isAppleOriginal,
        deletedAt,
        active: false,
        status: 'INACTIVE',
        model: { id: 'model-1', name: 'iPhone 17 Pro Max' },
        storage: { id: 'storage-256', displayName: '256 GB' },
      };
      const restored = { ...historical, deletedAt: null, active: true, status: 'ACTIVE' };
      const transaction = {
        product: {
          findUnique: vi.fn().mockResolvedValue(historical),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue(restored),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      const prisma = {
        $transaction: vi.fn(async (callback) => callback(transaction)),
        product: transaction.product,
      };
      const repository = new ProductsRepository(prisma as unknown as PrismaService);

      const result = await repository.restoreProduct('product-1', !isAppleOriginal, 'user-1');

      expect(result).toEqual({ status: 'restored', oldValue: historical, product: restored });
      expect(transaction.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: {
          deletedAt: null,
          active: true,
          status: 'ACTIVE',
          updatedBy: 'user-1',
        },
        include: expect.any(Object),
      });
      expect(restored).toMatchObject({
        id: historical.id,
        modelId: historical.modelId,
        profitCondition: historical.profitCondition,
        productDescription: historical.productDescription,
        normalizedDescription: historical.normalizedDescription,
        profitProductId: historical.profitProductId,
        netProfit: historical.netProfit,
        isAppleOriginal,
      });
      expect(transaction.auditLog.create).toHaveBeenCalledTimes(1);
    },
  );

  it.each([true, false])(
    'restores a null historical classification only from an explicit decision %s',
    async (isAppleOriginal) => {
      const historical = {
        id: 'product-1',
        ...dto,
        normalizedDescription: 'iphone 17 pro max 256gb',
        isAppleOriginal: null,
        deletedAt: new Date(),
        active: false,
        status: 'INACTIVE',
      };
      const update = vi.fn().mockResolvedValue({
        ...historical,
        deletedAt: null,
        active: true,
        status: 'ACTIVE',
        isAppleOriginal,
      });
      const transaction = {
        product: {
          findUnique: vi.fn().mockResolvedValue(historical),
          findMany: vi.fn().mockResolvedValue([]),
          update,
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      const prisma = {
        $transaction: vi.fn(async (callback) => callback(transaction)),
        product: transaction.product,
      };
      const repository = new ProductsRepository(prisma as unknown as PrismaService);

      await repository.restoreProduct('product-1', isAppleOriginal);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isAppleOriginal }) }),
      );
    },
  );

  it.each([
    ['missing Product', null, undefined, 'not_found'],
    [
      'already active Product',
      { ...dto, id: 'product-1', deletedAt: null },
      undefined,
      'not_deleted',
    ],
    [
      'null classification without decision',
      {
        ...dto,
        id: 'product-1',
        normalizedDescription: 'iphone 17 pro max 256gb',
        deletedAt: new Date(),
        isAppleOriginal: null,
      },
      undefined,
      'classification_required',
    ],
  ] as const)('performs no write for %s', async (_case, product, authority, status) => {
    const transaction = {
      product: {
        findUnique: vi.fn().mockResolvedValue(product),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product: transaction.product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await expect(repository.restoreProduct('product-1', authority)).resolves.toMatchObject({
      status,
    });
    expect(transaction.product.update).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('fails closed without a write when an eligible identity conflict exists', async () => {
    const historical = {
      id: 'product-1',
      ...dto,
      normalizedDescription: 'iphone 17 pro max 256gb',
      isAppleOriginal: true,
      deletedAt: new Date(),
    };
    const transaction = {
      product: {
        findUnique: vi.fn().mockResolvedValue(historical),
        findMany: vi.fn().mockResolvedValue([{ id: 'eligible-product' }]),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product: transaction.product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await expect(repository.restoreProduct('product-1')).resolves.toMatchObject({
      status: 'identity_conflict',
    });
    expect(transaction.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'product-1' },
          deletedAt: null,
          active: true,
          status: 'ACTIVE',
        }),
        take: 2,
      }),
    );
    expect(transaction.product.update).not.toHaveBeenCalled();
  });

  it('rolls back the restore when its atomic update fails', async () => {
    const committed = { deletedAt: new Date(), active: false, status: 'INACTIVE' };
    const transaction = {
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'product-1',
          ...dto,
          normalizedDescription: 'iphone 17 pro max 256gb',
          isAppleOriginal: true,
          ...committed,
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockRejectedValue(new Error('restore failed')),
      },
      auditLog: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product: transaction.product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await expect(repository.restoreProduct('product-1')).rejects.toThrow('restore failed');
    expect(committed).toEqual({
      deletedAt: expect.any(Date),
      active: false,
      status: 'INACTIVE',
    });
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('registers missing profit on the same Product without increasing Product count', async () => {
    const create = vi.fn();
    const update = vi.fn().mockResolvedValue({
      id: 'product-1',
      profitProductId: 133,
      netProfit: 1090,
    });
    const transaction = {
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'product-1', profitProductId: null }),
        findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
        create,
        update,
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product: transaction.product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    const result = await repository.updateProduct(
      'product-1',
      { ...dto, netProfit: 1090 },
      'user-1',
    );

    expect(result).toMatchObject({ id: 'product-1', profitProductId: 133, netProfit: 1090 });
    expect(create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-1' },
        data: expect.objectContaining({
          profitProductId: 133,
          netProfit: 1090,
          normalizedDescription: 'iphone 17 pro max 256gb',
        }),
      }),
    );
  });

  it('preserves the existing profit identity when the same Product is reprocessed', async () => {
    const findFirst = vi.fn();
    const update = vi.fn().mockResolvedValue({
      id: 'product-1',
      profitProductId: 133,
      netProfit: 1090,
    });
    const transaction = {
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 'product-1', profitProductId: 133 }),
        findFirst,
        create: vi.fn(),
        update,
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product: transaction.product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await repository.updateProduct('product-1', { ...dto, netProfit: 1090 }, 'user-1');
    await repository.updateProduct('product-1', { ...dto, netProfit: 1090 }, 'user-1');

    expect(findFirst).not.toHaveBeenCalled();
    expect(transaction.product.create).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'product-1' },
        data: expect.objectContaining({ profitProductId: 133, netProfit: 1090 }),
      }),
    );
  });

  it('creates the canonical Model and Product in the same transaction', async () => {
    const product = {
      findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
      create: vi.fn().mockResolvedValue({ id: 'product-133' }),
    };
    const transaction = {
      product,
      productModel: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'model-air' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);
    const profitProduct = {
      categoryId: dto.categoryId,
      productType: dto.productType,
      productDescription: dto.productDescription,
      profitCondition: dto.profitCondition,
      netProfit: dto.netProfit,
    };

    await repository.createProfitRegistration(
      profitProduct,
      {
        name: 'iPhone 17 Air',
        normalizedName: 'iphone-17-air',
        normalizationSource: 'legacy-canonical',
        productType: 'IPHONE_SEALED',
      },
      'user-1',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.productModel.create).toHaveBeenCalledWith({
      data: {
        categoryId: dto.categoryId,
        name: 'iPhone 17 Air',
        normalizedName: 'iphone-17-air',
        productType: 'IPHONE_SEALED',
      },
    });
    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ modelId: 'model-air', profitProductId: 133 }),
      }),
    );
  });

  it('creates an unknown cadastral model and its Product atomically', async () => {
    const product = {
      findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
      create: vi.fn().mockResolvedValue({ id: 'product-18', modelId: 'model-18' }),
    };
    const transaction = {
      product,
      productModel: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'model-18' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    const created = await repository.createProfitRegistration(
      {
        categoryId: dto.categoryId,
        storageId: 'storage-256',
        productType: dto.productType,
        productDescription: 'iPhone 18 Pro Max',
        profitCondition: dto.profitCondition,
        netProfit: dto.netProfit,
      },
      {
        name: 'iPhone 18 Pro Max',
        normalizedName: 'category:category-1:iphone-18-pro-max',
        normalizationSource: 'cadastral',
        productType: dto.productType,
      },
    );

    expect(transaction.productModel.create).toHaveBeenCalledWith({
      data: {
        categoryId: dto.categoryId,
        name: 'iPhone 18 Pro Max',
        normalizedName: 'category:category-1:iphone-18-pro-max',
        productType: dto.productType,
      },
    });
    expect(product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          modelId: 'model-18',
          storageId: 'storage-256',
          productDescription: 'iPhone 18 Pro Max',
          profitCondition: 'NOVO',
          netProfit: 590,
        }),
      }),
    );
    expect(created).toEqual({ id: 'product-18', modelId: 'model-18' });
  });

  it('blocks a duplicate resolved model key before creating either record', async () => {
    const product = {
      findFirst: vi.fn(),
      create: vi.fn(),
    };
    const transaction = {
      product,
      productModel: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing-model' }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(transaction)),
      product,
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await expect(
      repository.createProfitRegistration(
        {
          categoryId: dto.categoryId,
          productType: dto.productType,
          productDescription: 'iPhone 18 Pro Max',
          profitCondition: dto.profitCondition,
          netProfit: dto.netProfit,
        },
        {
          name: 'IPHONE 18 PRO MAX',
          normalizedName: 'category:category-1:iphone-18-pro-max',
          normalizationSource: 'cadastral',
          productType: dto.productType,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.productModel.create).not.toHaveBeenCalled();
    expect(product.create).not.toHaveBeenCalled();
  });

  it('keeps ProductModel and Product atomic when Product creation fails', async () => {
    const committedModels: Array<{ id: string }> = [];
    const prisma = {
      product: {},
      $transaction: vi.fn(async (callback) => {
        const stagedModels: Array<{ id: string }> = [];
        const transaction = {
          productModel: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(async () => {
              const model = { id: 'model-18' };
              stagedModels.push(model);
              return model;
            }),
          },
          product: {
            findFirst: vi.fn().mockResolvedValue({ profitProductId: 132 }),
            create: vi.fn().mockRejectedValue(new Error('product create failed')),
          },
        };

        const result = await callback(transaction);
        committedModels.push(...stagedModels);
        return result;
      }),
    };
    const repository = new ProductsRepository(prisma as unknown as PrismaService);

    await expect(
      repository.createProfitRegistration(
        {
          categoryId: dto.categoryId,
          productType: dto.productType,
          productDescription: 'iPhone 18 Pro Max',
          profitCondition: dto.profitCondition,
          netProfit: dto.netProfit,
        },
        {
          name: 'iPhone 18 Pro Max',
          normalizedName: 'category:category-1:iphone-18-pro-max',
          normalizationSource: 'cadastral',
          productType: dto.productType,
        },
      ),
    ).rejects.toThrow('product create failed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(committedModels).toEqual([]);
  });
});
