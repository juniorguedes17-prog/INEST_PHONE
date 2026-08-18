import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminDiagnosticsController } from './controller/admin-diagnostics.controller';
import { AdminDiagnosticsService } from './service/admin-diagnostics.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminDiagnosticsController],
  providers: [AdminDiagnosticsService],
})
export class AdminDiagnosticsModule {}
