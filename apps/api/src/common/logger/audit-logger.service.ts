import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface AuditPrismaClient {
  auditLog?: {
    create(args: {
      data: {
        userId?: string | null;
        operationType: 'LOGIN' | 'LOGOUT' | 'ERROR';
        entity: string;
        entityId?: string | null;
        context?: Record<string, unknown>;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }): Promise<unknown>;
  };
}

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);

  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  logTechnicalEvent(event: string, context?: Record<string, unknown>) {
    this.logger.log({
      event,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  async logAuthEvent(
    operationType: 'LOGIN' | 'LOGOUT' | 'ERROR',
    event: string,
    userId?: string | null,
    context?: Record<string, unknown> | null,
  ) {
    this.logTechnicalEvent(event, { userId, ...context });

    try {
      await this.prisma.auditLog?.create({
        data: {
          userId,
          operationType,
          entity: 'auth',
          entityId: userId ?? null,
          context: {
            event,
            ...(context ?? {}),
          },
          ipAddress: typeof context?.ipAddress === 'string' ? context.ipAddress : null,
          userAgent: typeof context?.userAgent === 'string' ? context.userAgent : null,
        },
      });
    } catch (error) {
      this.logger.warn({
        event: 'audit.auth_event_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private get prisma(): AuditPrismaClient {
    return this.prismaService as unknown as AuditPrismaClient;
  }
}
