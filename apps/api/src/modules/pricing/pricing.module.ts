import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { PricingController } from './controller/pricing.controller';
import { PricingRepository } from './repository/pricing.repository';
import { PricingService } from './service/pricing.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [PricingController],
  providers: [PricingService, PricingRepository],
  exports: [PricingService],
})
export class PricingModule {}
