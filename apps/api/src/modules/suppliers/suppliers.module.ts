import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SuppliersController } from './controller/suppliers.controller';
import { SuppliersRepository } from './repository/suppliers.repository';
import { SuppliersService } from './service/suppliers.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SuppliersController],
  providers: [SuppliersService, SuppliersRepository],
  exports: [SuppliersService],
})
export class SuppliersModule {}
