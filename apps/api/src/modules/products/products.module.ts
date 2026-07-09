import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsController } from './controller/products.controller';
import { ProductsRepository } from './repository/products.repository';
import { ProductsService } from './service/products.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
