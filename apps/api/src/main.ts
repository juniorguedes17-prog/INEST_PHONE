import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const appLogger = app.get(AppLoggerService);
  app.useLogger(appLogger);
  const logger = new Logger('Bootstrap');
  const apiPrefix = config.get<string>('app.apiPrefix', 'api/v1');
  const corsOrigin = config.get<string>('app.corsOrigin', 'http://localhost:3000');
  const configuredPort = config.get<number>('app.port', 3333);
  const PORT = Number(process.env.PORT ?? configuredPort);

  if (!Number.isInteger(PORT) || PORT <= 0) {
    throw new Error('PORT deve ser um numero inteiro positivo.');
  }
  const apiVersion = config.get<string>('app.apiVersion', '1.0.0');
  const swaggerEnabled = config.get<boolean>('app.swaggerEnabled', true);

  app.setGlobalPrefix(apiPrefix);
  const allowedOrigins = corsOrigin
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  let swaggerReady = false;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('iNest Phone API')
      .setDescription('API oficial da plataforma iNest Phone. Contratos tecnicos da aplicacao.')
      .setVersion(apiVersion)
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Autenticacao JWT preparada para os proximos modulos.',
      })
      .build();

    try {
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
      swaggerReady = true;
    } catch (error) {
      logger.warn(
        `Swagger indisponivel neste runtime: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`,
      );
    }
  }

  await app.listen(PORT, '0.0.0.0');
  logger.log(`API running on http://0.0.0.0:${PORT}/${apiPrefix}`);
  if (swaggerReady) {
    logger.log(`Swagger running on http://localhost:${PORT}/${apiPrefix}/docs`);
  }
}

void bootstrap();
