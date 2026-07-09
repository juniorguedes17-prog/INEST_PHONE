import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
  UpsertCategoryDto,
  UpsertColorDto,
  UpsertModelDto,
  UpsertStorageDto,
} from '../dto/product.dto';
import { ProductsRepository } from '../repository/products.repository';
import { ensureExists } from '../validators/products.validators';

@Injectable()
export class ProductsService {
  constructor(@Inject(ProductsRepository) private readonly productsRepository: ProductsRepository) {}

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

  async update(id: string, dto: UpdateProductDto, user?: AuthenticatedUser) {
    const oldValue = await this.productsRepository.findProduct(id);
    ensureExists(oldValue, 'Produto nao encontrado.');
    await this.validateReferences(dto);
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
}
