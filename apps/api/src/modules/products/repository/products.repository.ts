import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateProductDto,
  CreateProfitRegistrationModelDto,
  CreateProfitRegistrationProductDto,
  ProductQueryDto,
  UpdateProductDto,
  UpsertCategoryDto,
  UpsertColorDto,
  UpsertModelDto,
  UpsertStorageDto,
} from '../dto/product.dto';
import { ProductRecord, ProductsPrismaClient } from '../interfaces/products-prisma.interface';
import { normalizeProfitProductDescription } from '../../pricing/providers/google-sheets-profit.provider';

@Injectable()
export class ProductsRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listProducts(query: ProductQueryDto) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        categoryId: query.categoryId,
        modelId: query.modelId,
        colorId: query.colorId,
        storageId: query.storageId,
        status: query.status,
        productType: query.productType,
        OR: query.search
          ? [
              { model: { name: { contains: query.search, mode: 'insensitive' } } },
              { category: { name: { contains: query.search, mode: 'insensitive' } } },
              { color: { name: { contains: query.search, mode: 'insensitive' } } },
              { storage: { displayName: { contains: query.search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: this.include,
      orderBy: { updatedAt: 'desc' },
    });
  }

  findProduct(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: this.include,
    });
  }

  createProduct(dto: CreateProductDto, userId?: string) {
    return this.createManualProfitProduct(dto, userId);
  }

  createProfitRegistration(
    product: CreateProfitRegistrationProductDto,
    model: CreateProfitRegistrationModelDto,
    userId?: string,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const existingModel = await transaction.productModel.findUnique({
        where: { normalizedName: model.canonicalModelKey },
      });
      if (existingModel) {
        throw new Error('Modelo canonico ja existe no catalogo.');
      }

      const createdModel = await transaction.productModel.create({
        data: {
          categoryId: product.categoryId,
          name: model.name,
          normalizedName: model.canonicalModelKey,
          productType: model.productType,
        },
      });
      const modelId = (createdModel as { id: string }).id;

      return this.createManualProfitProduct({ ...product, modelId }, userId, transaction);
    });
  }

  async createManualProfitProduct(
    dto: CreateProductDto,
    userId?: string,
    prisma: ProductsPrismaClient = this.prisma,
  ) {
    const latestProfitProduct = await prisma.product.findFirst({
      where: { profitProductId: { not: null } },
      orderBy: { profitProductId: 'desc' },
      select: { profitProductId: true },
    });

    return prisma.product.create({
      data: {
        ...dto,
        profitProductId: (latestProfitProduct?.profitProductId ?? 0) + 1,
        normalizedDescription: normalizeProfitProductDescription(dto.productDescription),
        status: dto.status ?? 'ACTIVE',
        active: true,
        createdBy: userId,
        updatedBy: userId,
      },
      include: this.include,
    });
  }

  updateProduct(id: string, dto: UpdateProductDto, userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        normalizedDescription: normalizeProfitProductDescription(dto.productDescription),
        updatedBy: userId,
      },
      include: this.include,
    });
  }

  softDeleteProduct(id: string, userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', active: false, updatedBy: userId },
      include: this.include,
    });
  }

  setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status, active: status === 'ACTIVE', updatedBy: userId },
      include: this.include,
    });
  }

  listReferences() {
    return Promise.all([
      this.prisma.productCategory.findMany({
        where: { deletedAt: null },
        orderBy: { name: 'asc' },
      }),
      this.prisma.productModel.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.productColor.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      this.prisma.productStorage.findMany({
        where: { deletedAt: null },
        orderBy: { displayName: 'asc' },
      }),
    ]);
  }

  findCategory(id: string) {
    return this.prisma.productCategory.findUnique({ where: { id } });
  }

  findModel(id: string) {
    return this.prisma.productModel.findUnique({ where: { id } });
  }

  findColor(id: string) {
    return this.prisma.productColor.findUnique({ where: { id } });
  }

  findStorage(id: string) {
    return this.prisma.productStorage.findUnique({ where: { id } });
  }

  findProfitIdentity(condition: string, normalizedDescription: string, excludedId?: string) {
    return this.prisma.product.findFirst({
      where: {
        profitCondition: condition,
        normalizedDescription,
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      include: this.include,
    });
  }

  createCategory(dto: UpsertCategoryDto) {
    return this.prisma.productCategory.create({ data: dto });
  }

  updateCategory(id: string, dto: UpsertCategoryDto) {
    return this.prisma.productCategory.update({ where: { id }, data: dto });
  }

  createModel(dto: UpsertModelDto) {
    return this.prisma.productModel.create({ data: dto });
  }

  updateModel(id: string, dto: UpsertModelDto) {
    return this.prisma.productModel.update({ where: { id }, data: dto });
  }

  createColor(dto: UpsertColorDto) {
    return this.prisma.productColor.create({ data: dto });
  }

  updateColor(id: string, dto: UpsertColorDto) {
    return this.prisma.productColor.update({ where: { id }, data: dto });
  }

  createStorage(dto: UpsertStorageDto) {
    return this.prisma.productStorage.create({ data: dto });
  }

  updateStorage(id: string, dto: UpsertStorageDto) {
    return this.prisma.productStorage.update({ where: { id }, data: dto });
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE' | 'DELETE';
    entityId?: string | null;
    oldValue?: ProductRecord | null;
    newValue?: ProductRecord | null;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'products', ...data },
    });
  }

  private get include() {
    return { category: true, model: true, color: true, storage: true };
  }

  private get prisma(): ProductsPrismaClient {
    return this.prismaService as unknown as ProductsPrismaClient;
  }
}
