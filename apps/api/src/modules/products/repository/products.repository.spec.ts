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
