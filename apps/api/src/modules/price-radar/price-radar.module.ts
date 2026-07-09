import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PriceRadarController } from './controller/price-radar.controller';
import { PriceRadarRepository } from './repository/price-radar.repository';
import { PriceRadarService } from './service/price-radar.service';

@Module({
  imports: [PrismaModule],
  controllers: [PriceRadarController],
  providers: [PriceRadarService, PriceRadarRepository],
  exports: [PriceRadarService],
})
export class PriceRadarModule {}
