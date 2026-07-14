import { createPrivateKey } from 'node:crypto';

type Env = Record<string, string | undefined>;

const requiredVariables = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
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
  const normalizedConfig = { ...config };
  const missing = requiredVariables.filter((key) => !config[key]);

  if (!config.PORT && !config.API_PORT) {
    missing.push('PORT ou API_PORT');
  }

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

  validateGoogleSheetsCredentials(normalizedConfig);

  return normalizedConfig;
}

function validateGoogleSheetsCredentials(config: Env) {
  if (!isEnabled(config.GOOGLE_SHEETS_ENABLED)) return;

  const requiredGoogleVariables = [
    'GOOGLE_SHEETS_CLIENT_EMAIL',
    'GOOGLE_SHEETS_PRIVATE_KEY',
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SHEETS_RANGE',
  ] as const;
  const missing = requiredGoogleVariables.filter((key) => !config[key]?.trim());

  if (missing.length > 0) {
    throw new Error(`Variaveis do Google Sheets ausentes: ${missing.join(', ')}`);
  }

  const clientEmail = config.GOOGLE_SHEETS_CLIENT_EMAIL!.trim();
  if (!/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(clientEmail)) {
    throw new Error(
      'Variavel GOOGLE_SHEETS_CLIENT_EMAIL invalida: use o client_email da mesma conta de servico da chave privada.',
    );
  }

  const privateKey = normalizePrivateKey(config.GOOGLE_SHEETS_PRIVATE_KEY!);
  if (!isPemPrivateKey(privateKey)) {
    throw new Error(
      'Variavel GOOGLE_SHEETS_PRIVATE_KEY invalida: informe a private_key completa em formato PEM.',
    );
  }

  try {
    createPrivateKey(privateKey);
  } catch {
    throw new Error(
      'Variavel GOOGLE_SHEETS_PRIVATE_KEY invalida: a chave PEM nao pode ser decodificada.',
    );
  }

  config.GOOGLE_SHEETS_CLIENT_EMAIL = clientEmail;
  config.GOOGLE_SHEETS_PRIVATE_KEY = privateKey;
  config.GOOGLE_SHEETS_SPREADSHEET_ID = config.GOOGLE_SHEETS_SPREADSHEET_ID!.trim();
  config.GOOGLE_SHEETS_RANGE = config.GOOGLE_SHEETS_RANGE!.trim();
}

export function normalizePrivateKey(value: string) {
  let normalized = value.trim();
  const hasWrappingQuotes =
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"));

  if (hasWrappingQuotes) normalized = normalized.slice(1, -1);

  return normalized
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function isPemPrivateKey(value: string) {
  return /^-----BEGIN (?:RSA )?PRIVATE KEY-----\n[\s\S]+\n-----END (?:RSA )?PRIVATE KEY-----$/.test(
    value,
  );
}

function isEnabled(value: string | undefined) {
  return ['true', '1', 'yes', 'on'].includes(value?.trim().toLowerCase() ?? '');
}
