import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  SupplierContactRecord,
  SupplierContactsPrismaClient,
} from '../interfaces/supplier-contacts-prisma.interface';

@Injectable()
export class SupplierContactsRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  findActiveByWhatsappNumber(whatsappNumber: string): Promise<SupplierContactRecord | null> {
    return this.prisma.supplierContact.findFirst({
      where: {
        whatsappNumber,
        isActive: true,
      },
    });
  }

  list(search?: string, isActive?: boolean): Promise<SupplierContactRecord[]> {
    return this.prisma.supplierContact.findMany({
      where: {
        isActive,
        OR: search
          ? [
              { supplierName: { contains: search, mode: 'insensitive' } },
              { whatsappNumber: { contains: search } },
              { address: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [{ isActive: 'desc' }, { supplierName: 'asc' }, { whatsappNumber: 'asc' }],
    });
  }

  findById(id: string): Promise<SupplierContactRecord | null> {
    return this.prisma.supplierContact.findUnique({ where: { id } });
  }

  findByWhatsappNumber(whatsappNumber: string): Promise<SupplierContactRecord | null> {
    return this.prisma.supplierContact.findUnique({ where: { whatsappNumber } });
  }

  create(data: {
    supplierName: string;
    whatsappNumber: string;
    address: string | null;
  }): Promise<SupplierContactRecord> {
    return this.prisma.supplierContact.create({ data });
  }

  update(
    id: string,
    data: { supplierName: string; whatsappNumber: string; address: string | null },
  ): Promise<SupplierContactRecord> {
    return this.prisma.supplierContact.update({ where: { id }, data });
  }

  setActive(id: string, isActive: boolean): Promise<SupplierContactRecord> {
    return this.prisma.supplierContact.update({ where: { id }, data: { isActive } });
  }

  private get prisma(): SupplierContactsPrismaClient {
    return this.prismaService as unknown as SupplierContactsPrismaClient;
  }
}
