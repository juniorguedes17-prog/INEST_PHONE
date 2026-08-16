import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CreateProductDto } from '../dto/product.dto';
import { ProductsRepository } from '../repository/products.repository';
import { ProductsService } from './products.service';

const dto: CreateProductDto = {
  categoryId: 'category-1',
  modelId: 'model-1',
  productType: 'IPHONE_SEALED',
  productDescription: 'iPhone 17 Pro Max 256GB',
  profitCondition: 'NOVO',
  netProfit: 590,
};

function createRepository(existing: unknown = null) {
  return {
    findCategory: vi.fn().mockResolvedValue({ id: dto.categoryId }),
    findModel: vi.fn().mockResolvedValue({ id: dto.modelId, categoryId: dto.categoryId }),
    findColor: vi.fn(),
    findStorage: vi.fn(),
    findProfitIdentity: vi.fn().mockResolvedValue(existing),
    createProduct: vi.fn().mockResolvedValue({ id: 'product-1', ...dto }),
    updateProduct: vi.fn().mockResolvedValue({ id: 'product-1', ...dto, netProfit: 1090 }),
    findProduct: vi.fn().mockResolvedValue({ id: 'product-1', ...dto }),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ProductsService manual catalog management', () => {
  it('creates a native product after validating its canonical profit identity', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await service.create(dto);

    expect(repository.findProfitIdentity).toHaveBeenCalledWith(
      'NOVO',
      'iphone 17 pro max 256gb',
      undefined,
    );
    expect(repository.createProduct).toHaveBeenCalledWith(dto, undefined);
  });

  it('blocks a duplicate condition and normalized description instead of overwriting it', async () => {
    const repository = createRepository({ id: 'existing-product' });
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createProduct).not.toHaveBeenCalled();
  });

  it('updates the persisted net profit using the existing product endpoint flow', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const updateDto = { ...dto, netProfit: 1090 };

    await service.update('product-1', updateDto);

    expect(repository.updateProduct).toHaveBeenCalledWith('product-1', updateDto, undefined);
  });
});
