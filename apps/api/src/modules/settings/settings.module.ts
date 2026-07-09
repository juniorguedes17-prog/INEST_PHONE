import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SettingsController } from './controller/settings.controller';
import { SettingsRepository } from './repository/settings.repository';
import { SettingsService } from './service/settings.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}
