import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PricingModule } from '../pricing/pricing.module';
import { SettingsModule } from '../settings/settings.module';
import { WorkSnapshotsModule } from '../work-snapshots/work-snapshots.module';
import { OffersController } from './controller/offers.controller';
import { OffersRepository } from './repository/offers.repository';
import { OffersService } from './service/offers.service';
import { OffersWorkSnapshotService } from './service/offers-work-snapshot.service';

@Module({
  imports: [PrismaModule, PricingModule, SettingsModule, WorkSnapshotsModule],
  controllers: [OffersController],
  providers: [OffersService, OffersWorkSnapshotService, OffersRepository],
  exports: [OffersService],
})
export class OffersModule {}
