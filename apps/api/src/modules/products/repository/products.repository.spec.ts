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
        canonicalModelKey: 'iphone-17-air',
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
});
