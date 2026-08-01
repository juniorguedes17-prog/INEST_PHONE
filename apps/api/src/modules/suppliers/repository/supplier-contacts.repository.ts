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

  private get prisma(): SupplierContactsPrismaClient {
    return this.prismaService as unknown as SupplierContactsPrismaClient;
  }
}
