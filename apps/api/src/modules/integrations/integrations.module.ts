import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegrationsController } from './controller/integrations.controller';
import { IntegrationsRepository } from './repository/integrations.repository';
import { IntegrationsService } from './service/integrations.service';
import { ComprasParaguaiIntegrationProvider } from './providers/compras-paraguai-integration.provider';
import {
  CsvExportProvider,
  ExcelExportProvider,
  PdfExportProvider,
} from './providers/export.providers';
import { GoogleSheetsProvider } from './providers/google-sheets.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationsRepository,
    GoogleSheetsProvider,
    WhatsappProvider,
    ComprasParaguaiIntegrationProvider,
    CsvExportProvider,
    ExcelExportProvider,
    PdfExportProvider,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
