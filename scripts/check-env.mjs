import { existsSync } from 'node:fs';
import { envFileFor, parseEnvFile } from './env-utils.mjs';

const target = process.argv[2] ?? 'development';
const allowPlaceholders = process.argv.includes('--allow-placeholders');
const envFile = envFileFor(target);

const required = [
  'NODE_ENV',
  'APP_ENV',
  'FRONTEND_URL',
  'BACKEND_URL',
  'NEXT_PUBLIC_API_URL',
  'API_PORT',
  'PORT',
  'API_PREFIX',
  'API_VERSION',
  'CORS_ORIGIN',
  'LOG_LEVEL',
  'SWAGGER_ENABLED',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'SEED_ADMIN_EMAIL',
  'SEED_ADMIN_PASSWORD',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'GOOGLE_SHEETS_ENABLED',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_SHEETS_ID',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_SHEETS_PROFIT_SPREADSHEET_ID',
  'GOOGLE_SHEETS_PROFIT_RANGE',
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
  'WHATSAPP_ENABLED',
  'WHATSAPP_BASE_URL',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_DEFAULT_MESSAGE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'SENTRY_DSN',
  'BETTER_STACK_SOURCE_TOKEN',
  'OPENAI_API_KEY',
  'IMPORT_PROVIDER_KEY',
];

if (!existsSync(envFile)) {
  throw new Error(`Arquivo de ambiente nao encontrado: ${envFile}`);
}

const env = {
  ...parseEnvFile(envFile),
  ...(target === 'development' && existsSync('.env.local') ? parseEnvFile('.env.local') : {}),
};
const missing = required.filter((key) => !(key in env));

if (missing.length > 0) {
  throw new Error(`${envFile} esta sem variaveis: ${missing.join(', ')}`);
}

if (!allowPlaceholders) {
  const placeholders = Object.entries(env).filter(([, value]) =>
    /replace-with|USER:PASSWORD@HOST|change-me/i.test(value),
  );

  if (placeholders.length > 0) {
    throw new Error(
      `${envFile} possui placeholders: ${placeholders.map(([key]) => key).join(', ')}`,
    );
  }
}

console.log(`${envFile} OK`);
