import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { EvolutionWebhookModule } from '../evolution-webhook/evolution-webhook.module';
import { ManufacturersModule } from '../manufacturers/manufacturers.module';
import { ImportRadarController } from './controller/import-radar.controller';
import { AmazonUsProvider } from './providers/amazon-us.provider';
import { AppleUsProvider } from './providers/apple-us.provider';
import { ComprasParaguaiProvider } from './providers/compras-paraguai.provider';
import { MockImportProvider } from './providers/mock-import.provider';
import { UpcItemDbUsProvider } from './providers/upcitemdb-us.provider';
import { ImportRadarRepository } from './repository/import-radar.repository';
import { ImportRadarService } from './service/import-radar.service';
import { UsaLunaEnrichmentShadowService } from './service/usa-luna-enrichment-shadow.service';
import { UsaLunaEnrichmentValidatorService } from './service/usa-luna-enrichment-validator.service';
import { UsaProvidersOrchestrator } from './service/usa-providers-orchestrator.service';
import { ShippingWeightsModule } from './shipping-weights/shipping-weights.module';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    EvolutionWebhookModule,
    ManufacturersModule,
    ShippingWeightsModule,
  ],
  controllers: [ImportRadarController],
  providers: [
    ImportRadarService,
    UsaLunaEnrichmentShadowService,
    UsaLunaEnrichmentValidatorService,
    UsaProvidersOrchestrator,
    ImportRadarRepository,
    MockImportProvider,
    ComprasParaguaiProvider,
    AppleUsProvider,
    AmazonUsProvider,
    UpcItemDbUsProvider,
  ],
  exports: [ImportRadarService],
})
export class ImportRadarModule {}
