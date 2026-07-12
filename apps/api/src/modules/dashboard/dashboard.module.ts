import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DashboardController } from './controller/dashboard.controller';
import { DashboardRepository } from './repository/dashboard.repository';
import { DashboardService } from './service/dashboard.service';

@Module({
  imports: [PrismaModule, IntegrationsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
