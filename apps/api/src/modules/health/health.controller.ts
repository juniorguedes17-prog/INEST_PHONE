import { Controller, Get, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    let database = 'connected';

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Database health check failed');
      database = 'disconnected';
    }

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      version: this.config.get<string>('app.apiVersion', '1.0.0'),
      timestamp: new Date().toISOString(),
    };
  }
}
