import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('Iniciando conexao do Prisma sem bloquear o servidor HTTP');

    void this.connectInBackground();
  }

  private async connectInBackground() {
    try {
      await this.$connect();
      this.logger.log('Prisma conectado');
    } catch (error) {
      this.logger.error(
        `Falha na conexao inicial do Prisma: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
