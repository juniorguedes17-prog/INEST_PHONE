import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3333),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL ?? 'http://localhost:3333',
  apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  apiVersion: process.env.API_VERSION ?? '1.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  evolutionWebhookEnabled: process.env.EVOLUTION_WEBHOOK_ENABLED === 'true',
  evolutionWebhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET?.trim() ?? '',
  aiRecoveryEnabled: process.env.AI_RECOVERY_ENABLED === 'true',
  aiPricingNormalizationEnabled: process.env.AI_PRICING_NORMALIZATION_ENABLED === 'true',
  aiRecoveryModel: process.env.AI_RECOVERY_MODEL?.trim() || 'gpt-5.6-luna',
  aiRecoveryDailyBudgetUsd: Number(process.env.AI_RECOVERY_DAILY_BUDGET_USD ?? 0),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
}));
