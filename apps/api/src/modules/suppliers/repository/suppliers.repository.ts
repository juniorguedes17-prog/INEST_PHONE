import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { SupplierRecord, SuppliersPrismaClient } from '../interfaces/suppliers-prisma.interface';

@Injectable()
export class SuppliersRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  list(query: SupplierQueryDto) {
    return this.prisma.supplier.findMany({
      where: {
        deletedAt: null,
        source: query.source,
        status: query.status,
        OR: query.search
          ? [
              { name: { contains: query.search, mode: 'insensitive' } },
              { contact: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { source: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } });
  }

  create(dto: CreateSupplierDto, userId?: string) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        phone: dto.phone,
        source: dto.source,
        status: dto.status ?? 'ACTIVE',
        createdBy: userId,
        updatedBy: userId,
      },
    });
  }

  update(id: string, dto: UpdateSupplierDto, userId?: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        contact: dto.contact,
        phone: dto.phone,
        source: dto.source,
        status: dto.status ?? 'ACTIVE',
        updatedBy: userId,
      },
    });
  }

  softDelete(id: string, userId?: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        updatedBy: userId,
      },
    });
  }

  setStatus(id: string, status: 'ACTIVE' | 'INACTIVE', userId?: string) {
    return this.prisma.supplier.update({
      where: { id },
      data: { status, updatedBy: userId },
    });
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE' | 'DELETE';
    entityId?: string | null;
    oldValue?: SupplierRecord | null;
    newValue?: SupplierRecord | null;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'suppliers', ...data },
    });
  }

  private get prisma(): SuppliersPrismaClient {
    return this.prismaService as unknown as SuppliersPrismaClient;
  }
}
