import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { buildProductModelNormalizedName } from '../product-model-normalizer';

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
    this.ensureExplicitFinancialClassification(dto);
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
    this.ensureExplicitFinancialClassification(dto.product);
    if (dto.model.productType !== dto.product.productType) {
      throw new NotFoundException('Modelo canonico incompativel com o tipo comercial do produto.');
    }

    await this.validateProfitRegistrationReferences(dto.product);
    await this.ensureUniqueProfitIdentity(dto.product);
    const usesLegacyCanonicalKey = dto.model.canonicalModelKey !== undefined;
    const normalizedName =
      dto.model.canonicalModelKey ??
      buildProductModelNormalizedName({
        categoryId: dto.product.categoryId,
        modelName: dto.model.name,
      });
    let product;
    try {
      product = await this.productsRepository.createProfitRegistration(
        dto.product,
        {
          name: dto.model.name,
          normalizedName,
          normalizationSource: usesLegacyCanonicalKey ? 'legacy-canonical' : 'cadastral',
          productType: dto.model.productType,
        },
        user?.id,
      );
    } catch (error) {
      if (!usesLegacyCanonicalKey && isUniqueConstraintError(error)) {
        throw new ConflictException('Modelo ja existe no escopo cadastral informado.');
      }
      throw error;
    }
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
    const lifecycle = oldValue as typeof oldValue & { deletedAt?: Date | null };
    const isMissingProfit =
      lifecycle.profitProductId === null ||
      lifecycle.profitProductId === undefined ||
      lifecycle.netProfit === null ||
      lifecycle.netProfit === undefined;
    if (
      isMissingProfit &&
      (lifecycle.deletedAt !== null || lifecycle.active !== true || lifecycle.status !== 'ACTIVE')
    ) {
      throw new ConflictException('Produto nao esta elegivel para cadastro de lucro.');
    }
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

  async restore(id: string, explicitIsAppleOriginal?: boolean | null, user?: AuthenticatedUser) {
    const result = await this.productsRepository.restoreProduct(
      id,
      explicitIsAppleOriginal,
      user?.id,
    );
    if (result.status === 'not_found') {
      throw new NotFoundException('Produto nao encontrado.');
    }
    if (result.status === 'not_deleted') {
      throw new ConflictException('Produto nao esta excluido e nao pode ser restaurado.');
    }
    if (result.status === 'classification_required') {
      throw new BadRequestException(
        'Classificacao financeira do produto deve ser informada para restauracao.',
      );
    }
    if (result.status === 'identity_conflict') {
      throw new ConflictException('Identidade financeira ja pertence a um produto elegivel.');
    }
    return result.product;
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

  async createModel(dto: UpsertModelDto) {
    if (dto.normalizedName !== undefined) {
      return this.productsRepository.createModel({
        ...dto,
        normalizedName: dto.normalizedName,
      });
    }

    const category = await this.productsRepository.findCategory(dto.categoryId);
    ensureExists(category, 'Categoria invalida.');
    if (category && 'type' in category && category.type !== dto.productType) {
      throw new NotFoundException('Categoria comercial incompativel com o tipo do produto.');
    }

    const normalizedName = buildProductModelNormalizedName({
      categoryId: dto.categoryId,
      modelName: dto.name,
    });
    const existingModel = await this.productsRepository.findModelByNormalizedName(normalizedName);
    if (existingModel) {
      throw new ConflictException('Modelo ja existe no escopo cadastral informado.');
    }

    try {
      return await this.productsRepository.createModel({ ...dto, normalizedName });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Modelo ja existe no escopo cadastral informado.');
      }
      throw error;
    }
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

  private ensureExplicitFinancialClassification(dto: Pick<CreateProductDto, 'isAppleOriginal'>) {
    if (typeof dto.isAppleOriginal !== 'boolean') {
      throw new BadRequestException('Classificacao financeira do produto deve ser informada.');
    }
  }
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
