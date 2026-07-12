import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditLoggerService } from './common/logger/audit-logger.service';
import { AppLoggerService } from './common/logger/app-logger.service';
import { HttpLoggerMiddleware } from './common/middlewares/http-logger.middleware';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { validateEnv } from './config/env.validation';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { ImportRadarModule } from './modules/import-radar/import-radar.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { OffersModule } from './modules/offers/offers.module';
import { PriceRadarModule } from './modules/price-radar/price-radar.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ProductsModule } from './modules/products/products.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PrismaModule } from './prisma/prisma.module';

const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';
const envFileName = `.env.${appEnv}`;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env.local',
        '../../.env.local',
        envFileName,
        `../../${envFileName}`,
        '.env',
        '../../.env',
      ],
      load: [appConfig, authConfig, databaseConfig],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    CustomersModule,
    DashboardModule,
    HealthModule,
    SettingsModule,
    ProductsModule,
    SuppliersModule,
    PriceRadarModule,
    PricingModule,
    ImportRadarModule,
    OffersModule,
    IntegrationsModule,
  ],
  providers: [AppLoggerService, AuditLoggerService],
  exports: [AppLoggerService, AuditLoggerService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
