import { ConsoleLogger, Inject, Injectable, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    super('iNest API', {
      timestamp: true,
      logLevels: AppLoggerService.resolveLogLevels(config.get<string>('app.logLevel', 'debug')),
    });
  }

  private static resolveLogLevels(level: string): LogLevel[] {
    if (level === 'error') return ['error'];
    if (level === 'warn') return ['error', 'warn'];
    if (level === 'log') return ['error', 'warn', 'log'];
    if (level === 'verbose') return ['error', 'warn', 'log', 'verbose'];
    return ['error', 'warn', 'log', 'debug', 'verbose'];
  }
}
