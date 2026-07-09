import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
  UpsertCategoryDto,
  UpsertColorDto,
  UpsertModelDto,
  UpsertStorageDto,
} from '../dto/product.dto';
import { ProductRecord, ProductsPrismaClient } from '../interfaces/products-prisma.interface';

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
    return this.prisma.product.create({
      data: { ...dto, status: dto.status ?? 'ACTIVE', createdBy: userId, updatedBy: userId },
      include: this.include,
    });
  }

  updateProduct(id: string, dto: UpdateProductDto, userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: { ...dto, updatedBy: userId },
      include: this.include,
    });
  }

  softDeleteProduct(id: string, userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: userId },
      include: this.include,
    });
  }

  setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId?: string) {
    return this.prisma.product.update({
      where: { id },
      data: { status, updatedBy: userId },
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
