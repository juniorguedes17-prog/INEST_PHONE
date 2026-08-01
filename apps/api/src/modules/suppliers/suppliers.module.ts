import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SuppliersController } from './controller/suppliers.controller';
import { SuppliersRepository } from './repository/suppliers.repository';
import { SupplierContactsRepository } from './repository/supplier-contacts.repository';
import { SuppliersService } from './service/suppliers.service';
import { SupplierContactsService } from './service/supplier-contacts.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SuppliersController],
  providers: [
    SuppliersService,
    SuppliersRepository,
    SupplierContactsService,
    SupplierContactsRepository,
  ],
  exports: [SuppliersService, SupplierContactsService],
})
export class SuppliersModule {}
