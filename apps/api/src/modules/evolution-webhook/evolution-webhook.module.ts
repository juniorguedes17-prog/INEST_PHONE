import { Module } from '@nestjs/common';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { EvolutionWebhookController } from './evolution-webhook.controller';
import { EvolutionWebhookService } from './evolution-webhook.service';

@Module({
  imports: [SuppliersModule],
  controllers: [EvolutionWebhookController],
  providers: [EvolutionWebhookService],
})
export class EvolutionWebhookModule {}
