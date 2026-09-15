import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CreateProductDto } from '../dto/product.dto';
import { ProductsRepository } from '../repository/products.repository';
import { ProductsService } from './products.service';

const dto: CreateProductDto = {
  categoryId: 'category-1',
  modelId: 'model-1',
  productType: 'IPHONE_SEALED',
  isAppleOriginal: true,
  productDescription: 'iPhone 17 Pro Max 256GB',
  profitCondition: 'NOVO',
  netProfit: 590,
};

function createRepository(existing: unknown = null) {
  return {
    findCategory: vi.fn().mockResolvedValue({ id: dto.categoryId, type: dto.productType }),
    findModel: vi.fn().mockResolvedValue({ id: dto.modelId, categoryId: dto.categoryId }),
    findColor: vi.fn(),
    findStorage: vi.fn().mockResolvedValue({ id: 'storage-256' }),
    findModelByNormalizedName: vi.fn().mockResolvedValue(null),
    findProfitIdentity: vi.fn().mockResolvedValue(existing),
    createProduct: vi.fn().mockResolvedValue({ id: 'product-1', ...dto }),
    createProfitRegistration: vi.fn().mockResolvedValue({ id: 'product-2', ...dto }),
    createModel: vi.fn().mockResolvedValue({ id: 'model-2' }),
    updateProduct: vi.fn().mockResolvedValue({ id: 'product-1', ...dto, netProfit: 1090 }),
    restoreProduct: vi.fn().mockResolvedValue({
      status: 'restored',
      oldValue: { id: 'product-1', ...dto, deletedAt: new Date() },
      product: {
        id: 'product-1',
        ...dto,
        deletedAt: null,
        active: true,
        status: 'ACTIVE',
      },
    }),
    findProduct: vi.fn().mockResolvedValue({
      id: 'product-1',
      ...dto,
      profitProductId: 1,
      active: true,
      status: 'ACTIVE',
      deletedAt: null,
    }),
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

  it.each([true, false])(
    'preserves the explicit Apple originality classification %s in the Product API flow',
    async (isAppleOriginal) => {
      const repository = createRepository();
      const service = new ProductsService(repository as unknown as ProductsRepository);
      const classifiedDto = { ...dto, isAppleOriginal };

      await service.create(classifiedDto);

      expect(repository.createProduct).toHaveBeenCalledWith(classifiedDto, undefined);
    },
  );

  it.each([undefined, null])(
    'rejects a new Product without explicit financial classification (%s)',
    async (isAppleOriginal) => {
      const repository = createRepository();
      const service = new ProductsService(repository as unknown as ProductsRepository);

      await expect(service.create({ ...dto, isAppleOriginal })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(repository.createProduct).not.toHaveBeenCalled();
    },
  );

  it('blocks a duplicate condition and normalized description instead of overwriting it', async () => {
    const repository = createRepository({ id: 'existing-product' });
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createProduct).not.toHaveBeenCalled();
  });

  it.each([
    ['soft-deleted', { deletedAt: new Date(), active: false, status: 'INACTIVE' }],
    ['inactive', { deletedAt: null, active: false, status: 'ACTIVE' }],
    ['non-active status', { deletedAt: null, active: true, status: 'INACTIVE' }],
  ] as const)(
    'blocks profit registration when only a %s Product occupies the financial identity',
    async (_state, lifecycle) => {
      const repository = createRepository();
      repository.findProduct.mockResolvedValue({
        id: 'historical-product',
        ...dto,
        profitProductId: null,
        netProfit: null,
        ...lifecycle,
      });
      const service = new ProductsService(repository as unknown as ProductsRepository);

      await expect(service.update('historical-product', dto)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(repository.createProduct).not.toHaveBeenCalled();
      expect(repository.updateProduct).not.toHaveBeenCalled();
    },
  );

  it('updates the persisted net profit using the existing product endpoint flow', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const updateDto = { ...dto, netProfit: 1090 };

    await service.update('product-1', updateDto);

    expect(repository.updateProduct).toHaveBeenCalledWith('product-1', updateDto, undefined);
  });

  it.each([true, false])(
    'restores a soft-deleted Product while preserving explicit classification %s',
    async (isAppleOriginal) => {
      const repository = createRepository();
      const service = new ProductsService(repository as unknown as ProductsRepository);

      const result = await service.restore('product-1', !isAppleOriginal);

      expect(repository.restoreProduct).toHaveBeenCalledWith(
        'product-1',
        !isAppleOriginal,
        undefined,
      );
      expect(result).toMatchObject({ id: 'product-1', active: true, status: 'ACTIVE' });
    },
  );

  it('requires explicit classification when restoring a historical null Product', async () => {
    const repository = createRepository();
    repository.restoreProduct.mockResolvedValueOnce({ status: 'classification_required' });
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(service.restore('product-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['not_found', NotFoundException],
    ['not_deleted', ConflictException],
    ['identity_conflict', ConflictException],
  ] as const)('maps restore result %s to a controlled error', async (status, ErrorType) => {
    const repository = createRepository();
    repository.restoreProduct.mockResolvedValueOnce({ status });
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(service.restore('product-1')).rejects.toBeInstanceOf(ErrorType);
  });

  it('allows missing profit registration only on an eligible existing Product', async () => {
    const repository = createRepository();
    repository.findProduct.mockResolvedValue({
      id: 'product-1',
      ...dto,
      profitProductId: null,
      netProfit: null,
      active: true,
      status: 'ACTIVE',
      deletedAt: null,
    });
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const updateDto = { ...dto, netProfit: 1090 };

    await service.update('product-1', updateDto);

    expect(repository.updateProduct).toHaveBeenCalledWith('product-1', updateDto, undefined);
  });

  it('creates a canonical Model and Product only through the explicit profit registration flow', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const registration = {
      product: { ...dto, storageId: undefined },
      model: {
        name: 'iPhone 17 Air',
        canonicalModelKey: 'iphone-17-air',
        productType: 'IPHONE_SEALED',
      },
    };

    await service.createProfitRegistration(registration);

    expect(repository.createProfitRegistration).toHaveBeenCalledWith(
      registration.product,
      {
        name: 'iPhone 17 Air',
        normalizedName: 'iphone-17-air',
        normalizationSource: 'legacy-canonical',
        productType: 'IPHONE_SEALED',
      },
      undefined,
    );
  });

  it.each([true, false])(
    'preserves explicit financial classification %s in atomic Product creation',
    async (isAppleOriginal) => {
      const repository = createRepository();
      const service = new ProductsService(repository as unknown as ProductsRepository);
      const registration = {
        product: { ...dto, isAppleOriginal, storageId: undefined },
        model: {
          name: 'Modelo novo',
          productType: dto.productType,
        },
      };

      await service.createProfitRegistration(registration);

      expect(repository.createProfitRegistration).toHaveBeenCalledWith(
        registration.product,
        expect.any(Object),
        undefined,
      );
    },
  );

  it('rejects atomic Product creation without explicit financial classification', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(
      service.createProfitRegistration({
        product: { ...dto, isAppleOriginal: null, storageId: undefined },
        model: { name: 'Modelo novo', productType: dto.productType },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.createProfitRegistration).not.toHaveBeenCalled();
  });

  it('generates a scoped cadastral key for an unknown model without canonicalModelKey', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const registration = {
      product: {
        ...dto,
        productDescription: 'iPhone 18 Pro Max',
        storageId: 'storage-256',
      },
      model: {
        name: 'iPhone 18 Pro Max',
        productType: 'IPHONE_SEALED',
      },
    };

    await service.createProfitRegistration(registration);

    expect(repository.createProfitRegistration).toHaveBeenCalledWith(
      registration.product,
      {
        name: 'iPhone 18 Pro Max',
        normalizedName: 'category:category-1:iphone-18-pro-max',
        normalizationSource: 'cadastral',
        productType: 'IPHONE_SEALED',
      },
      undefined,
    );
  });

  it('rejects a Model whose type diverges from the commercial category type', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(
      service.createProfitRegistration({
        product: { ...dto, storageId: undefined },
        model: {
          name: 'iPhone 17 Air',
          canonicalModelKey: 'iphone-17-air',
          productType: 'APPLE_CPO',
        },
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(repository.createProfitRegistration).not.toHaveBeenCalled();
  });

  it('preserves legacy explicit normalizedName in POST products models', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const model = {
      categoryId: dto.categoryId,
      name: 'Modelo legado',
      normalizedName: 'legacy-explicit-key',
      productType: dto.productType,
    };

    await service.createModel(model);

    expect(repository.findCategory).not.toHaveBeenCalled();
    expect(repository.createModel).toHaveBeenCalledWith(model);
  });

  it('generates the cadastral key in POST products models and blocks same-scope duplicates', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);
    const model = {
      categoryId: dto.categoryId,
      name: 'iPhone 18 Pró Max',
      productType: dto.productType,
    };

    await service.createModel(model);

    const normalizedName = 'category:category-1:iphone-18-pro-max';
    expect(repository.createModel).toHaveBeenCalledWith({ ...model, normalizedName });

    repository.findModelByNormalizedName.mockResolvedValueOnce({ id: 'existing-model' });
    await expect(
      service.createModel({ ...model, name: 'IPHONE-18-PRO-MAX' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createModel).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a cadastral model type diverges from its category', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(
      service.createModel({
        categoryId: dto.categoryId,
        name: 'Modelo novo',
        productType: 'ACCESSORY',
      }),
    ).rejects.toBeInstanceOf(Error);
    expect(repository.createModel).not.toHaveBeenCalled();
  });

  it('keeps equal names in different categories on distinct cadastral keys', async () => {
    const repository = createRepository();
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await service.createModel({
      categoryId: 'category-a',
      name: 'Modelo Universal',
      productType: dto.productType,
    });
    await service.createModel({
      categoryId: 'category-b',
      name: 'Modelo Universal',
      productType: dto.productType,
    });

    expect(repository.createModel).toHaveBeenNthCalledWith(1, {
      categoryId: 'category-a',
      name: 'Modelo Universal',
      normalizedName: 'category:category-a:modelo-universal',
      productType: dto.productType,
    });
    expect(repository.createModel).toHaveBeenNthCalledWith(2, {
      categoryId: 'category-b',
      name: 'Modelo Universal',
      normalizedName: 'category:category-b:modelo-universal',
      productType: dto.productType,
    });
  });

  it('maps a cadastral unique-key race to a controlled conflict', async () => {
    const repository = createRepository();
    repository.createModel.mockRejectedValueOnce({ code: 'P2002' });
    const service = new ProductsService(repository as unknown as ProductsRepository);

    await expect(
      service.createModel({
        categoryId: dto.categoryId,
        name: 'iPhone 18 Pro Max',
        productType: dto.productType,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
