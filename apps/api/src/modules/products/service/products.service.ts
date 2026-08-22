import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateProductDto,
  CreateProfitRegistrationDto,
  ProductQueryDto,
  UpdateProductDto,
  UpsertCategoryDto,
  UpsertColorDto,
  UpsertModelDto,
  UpsertStorageDto,
} from '../dto/product.dto';
import { ProductsRepository } from '../repository/products.repository';
import { ensureExists } from '../validators/products.validators';
import { normalizeProfitProductDescription } from '../../pricing/providers/google-sheets-profit.provider';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(ProductsRepository) private readonly productsRepository: ProductsRepository,
  ) {}

  list(query: ProductQueryDto) {
    return this.productsRepository.listProducts(query);
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findProduct(id);
    ensureExists(product, 'Produto nao encontrado.');
    return product;
  }

  async create(dto: CreateProductDto, user?: AuthenticatedUser) {
    await this.validateReferences(dto);
    await this.ensureUniqueProfitIdentity(dto);
    const product = await this.productsRepository.createProduct(dto, user?.id);
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'CREATE',
      entityId: product.id,
      newValue: product,
      context: { event: 'products.created' },
    });
    return product;
  }

  async createProfitRegistration(dto: CreateProfitRegistrationDto, user?: AuthenticatedUser) {
    if (dto.model.productType !== dto.product.productType) {
      throw new NotFoundException('Modelo canonico incompativel com o tipo comercial do produto.');
    }

    await this.validateProfitRegistrationReferences(dto.product);
    await this.ensureUniqueProfitIdentity(dto.product);
    const product = await this.productsRepository.createProfitRegistration(
      dto.product,
      dto.model,
      user?.id,
    );
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'CREATE',
      entityId: product.id,
      newValue: product,
      context: { event: 'products.profit_registration_created' },
    });
    return product;
  }

  async update(id: string, dto: UpdateProductDto, user?: AuthenticatedUser) {
    const oldValue = await this.productsRepository.findProduct(id);
    ensureExists(oldValue, 'Produto nao encontrado.');
    await this.validateReferences(dto);
    await this.ensureUniqueProfitIdentity(dto, id);
    const product = await this.productsRepository.updateProduct(id, dto, user?.id);
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'UPDATE',
      entityId: product.id,
      oldValue,
      newValue: product,
      context: { event: 'products.updated' },
    });
    return product;
  }

  async softDelete(id: string, user?: AuthenticatedUser) {
    const oldValue = await this.productsRepository.findProduct(id);
    ensureExists(oldValue, 'Produto nao encontrado.');
    const product = await this.productsRepository.softDeleteProduct(id, user?.id);
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'DELETE',
      entityId: product.id,
      oldValue,
      newValue: product,
      context: { event: 'products.soft_deleted' },
    });
    return product;
  }

  async activate(id: string, user?: AuthenticatedUser) {
    const oldValue = await this.productsRepository.findProduct(id);
    ensureExists(oldValue, 'Produto nao encontrado.');
    const product = await this.productsRepository.setStatus(id, 'ACTIVE', user?.id);
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'UPDATE',
      entityId: product.id,
      oldValue,
      newValue: product,
      context: { event: 'products.activated' },
    });
    return product;
  }

  async deactivate(id: string, user?: AuthenticatedUser) {
    const oldValue = await this.productsRepository.findProduct(id);
    ensureExists(oldValue, 'Produto nao encontrado.');
    const product = await this.productsRepository.setStatus(id, 'INACTIVE', user?.id);
    await this.productsRepository.createAuditLog({
      userId: user?.id,
      operationType: 'UPDATE',
      entityId: product.id,
      oldValue,
      newValue: product,
      context: { event: 'products.deactivated' },
    });
    return product;
  }

  async references() {
    const [categories, models, colors, storages] = await this.productsRepository.listReferences();
    return { categories, models, colors, storages };
  }

  createCategory(dto: UpsertCategoryDto) {
    return this.productsRepository.createCategory(dto);
  }

  updateCategory(id: string, dto: UpsertCategoryDto) {
    return this.productsRepository.updateCategory(id, dto);
  }

  createModel(dto: UpsertModelDto) {
    return this.productsRepository.createModel(dto);
  }

  updateModel(id: string, dto: UpsertModelDto) {
    return this.productsRepository.updateModel(id, dto);
  }

  createColor(dto: UpsertColorDto) {
    return this.productsRepository.createColor(dto);
  }

  updateColor(id: string, dto: UpsertColorDto) {
    return this.productsRepository.updateColor(id, dto);
  }

  createStorage(dto: UpsertStorageDto) {
    return this.productsRepository.createStorage(dto);
  }

  updateStorage(id: string, dto: UpsertStorageDto) {
    return this.productsRepository.updateStorage(id, dto);
  }

  private async validateReferences(dto: CreateProductDto | UpdateProductDto) {
    const [category, model, color, storage] = await Promise.all([
      this.productsRepository.findCategory(dto.categoryId),
      this.productsRepository.findModel(dto.modelId),
      dto.colorId ? this.productsRepository.findColor(dto.colorId) : Promise.resolve(true),
      dto.storageId ? this.productsRepository.findStorage(dto.storageId) : Promise.resolve(true),
    ]);

    ensureExists(category, 'Categoria invalida.');
    ensureExists(model, 'Modelo invalido.');
    ensureExists(color, 'Cor invalida.');
    ensureExists(storage, 'Capacidade invalida.');

    if (model && 'categoryId' in model && model.categoryId !== dto.categoryId) {
      throw new NotFoundException('Modelo nao pertence a categoria informada.');
    }
  }

  private async validateProfitRegistrationReferences(dto: CreateProfitRegistrationDto['product']) {
    const [category, color, storage] = await Promise.all([
      this.productsRepository.findCategory(dto.categoryId),
      dto.colorId ? this.productsRepository.findColor(dto.colorId) : Promise.resolve(true),
      dto.storageId ? this.productsRepository.findStorage(dto.storageId) : Promise.resolve(true),
    ]);

    ensureExists(category, 'Categoria invalida.');
    ensureExists(color, 'Cor invalida.');
    ensureExists(storage, 'Capacidade invalida.');

    if (category && 'type' in category && category.type !== dto.productType) {
      throw new NotFoundException('Categoria comercial incompativel com o tipo do produto.');
    }
  }

  private async ensureUniqueProfitIdentity(
    dto: Pick<CreateProductDto, 'profitCondition' | 'productDescription'>,
    excludedId?: string,
  ) {
    const normalizedDescription = normalizeProfitProductDescription(dto.productDescription);
    const existing = await this.productsRepository.findProfitIdentity(
      dto.profitCondition,
      normalizedDescription,
      excludedId,
    );
    if (existing) {
      throw new ConflictException(
        'Ja existe um produto cadastrado para esta descricao e condicao.',
      );
    }
  }
}
