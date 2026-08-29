import { Module } from '@nestjs/common';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { EvolutionWebhookController } from './evolution-webhook.controller';
import { EvolutionWebhookService } from './evolution-webhook.service';
import { ProductNormalizationService } from './product-normalization.service';

@Module({
  imports: [SuppliersModule],
  controllers: [EvolutionWebhookController],
  providers: [EvolutionWebhookService, ProductNormalizationService],
})
export class EvolutionWebhookModule {}
