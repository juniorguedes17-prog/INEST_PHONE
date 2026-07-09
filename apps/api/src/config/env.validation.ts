type Env = Record<string, string | undefined>;

const requiredVariables = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'API_PORT',
  'API_PREFIX',
  'API_VERSION',
  'CORS_ORIGIN',
  'NEXT_PUBLIC_API_URL',
  'LOG_LEVEL',
  'SWAGGER_ENABLED',
  'WHATSAPP_BASE_URL',
];

const unsafeProductionValues = new Set([
  'change-me',
  'change-me-refresh',
  'development-only-change-me',
  'development-only-change-me-refresh',
  'replace-with-secure-secret',
  'replace-with-secure-refresh-secret',
  'replace-with-development-secret',
  'replace-with-development-refresh-secret',
  'replace-with-staging-secret',
  'replace-with-staging-refresh-secret',
  'replace-with-production-secret',
  'replace-with-production-refresh-secret',
]);

export function validateEnv(config: Env) {
  const missing = requiredVariables.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(`Variaveis de ambiente obrigatorias ausentes: ${missing.join(', ')}`);
  }

  const appEnv = config.APP_ENV ?? config.NODE_ENV ?? 'development';
  const unsafe = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((key) =>
    unsafeProductionValues.has(config[key] ?? ''),
  );

  if (unsafe.length > 0) {
    throw new Error(`Segredos inseguros em ${appEnv}: ${unsafe.join(', ')}`);
  }

  return config;
}
