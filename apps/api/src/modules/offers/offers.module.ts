import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { SettingsModule } from '../settings/settings.module';
import { OffersController } from './controller/offers.controller';
import { OffersRepository } from './repository/offers.repository';
import { OffersService } from './service/offers.service';

@Module({
  imports: [PrismaModule, PricingModule, SettingsModule],
  controllers: [OffersController],
  providers: [OffersService, OffersRepository],
  exports: [OffersService],
})
export class OffersModule {}
