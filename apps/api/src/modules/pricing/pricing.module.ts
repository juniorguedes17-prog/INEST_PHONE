import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { WorkSnapshotsModule } from '../work-snapshots/work-snapshots.module';
import { EvolutionWebhookModule } from '../evolution-webhook/evolution-webhook.module';
import { ManufacturersModule } from '../manufacturers/manufacturers.module';
import { PricingController } from './controller/pricing.controller';
import { GoogleSheetsProfitProvider } from './providers/google-sheets-profit.provider';
import { ProductProfitProvider } from './providers/product-profit.provider';
import { PricingRepository } from './repository/pricing.repository';
import { PricingService } from './service/pricing.service';
import { PricingWorkSnapshotService } from './service/pricing-work-snapshot.service';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    WorkSnapshotsModule,
    EvolutionWebhookModule,
    ManufacturersModule,
  ],
  controllers: [PricingController],
  providers: [
    PricingService,
    PricingWorkSnapshotService,
    PricingRepository,
    GoogleSheetsProfitProvider,
    ProductProfitProvider,
  ],
  exports: [PricingService],
})
export class PricingModule {}
