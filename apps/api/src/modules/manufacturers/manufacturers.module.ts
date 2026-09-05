import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ManufacturersRepository } from './repository/manufacturers.repository';
import { ManufacturersService } from './service/manufacturers.service';

@Module({
  imports: [PrismaModule],
  providers: [ManufacturersService, ManufacturersRepository],
  exports: [ManufacturersService],
})
export class ManufacturersModule {}
