import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { ImportRadarController } from './controller/import-radar.controller';
import { ComprasParaguaiProvider } from './providers/compras-paraguai.provider';
import { MockImportProvider } from './providers/mock-import.provider';
import { ImportRadarRepository } from './repository/import-radar.repository';
import { ImportRadarService } from './service/import-radar.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [ImportRadarController],
  providers: [
    ImportRadarService,
    ImportRadarRepository,
    MockImportProvider,
    ComprasParaguaiProvider,
  ],
  exports: [ImportRadarService],
})
export class ImportRadarModule {}
