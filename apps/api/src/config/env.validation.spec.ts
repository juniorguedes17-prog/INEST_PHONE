import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizePrivateKey, validateEnv } from './env.validation';

const validPrivateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString()
  .trim();

const baseConfig = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'secure-jwt-secret',
  JWT_REFRESH_SECRET: 'secure-refresh-secret',
  API_PREFIX: 'api/v1',
  API_VERSION: '1.0.0',
  CORS_ORIGIN: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://localhost:3333/api/v1',
  LOG_LEVEL: 'info',
  SWAGGER_ENABLED: 'true',
  WHATSAPP_BASE_URL: 'https://wa.me',
  PORT: '3333',
  GOOGLE_SHEETS_ENABLED: 'true',
  GOOGLE_SHEETS_CLIENT_EMAIL: 'sheets-reader@test-project.iam.gserviceaccount.com',
  GOOGLE_SHEETS_PRIVATE_KEY: validPrivateKey,
  GOOGLE_SHEETS_SPREADSHEET_ID: 'spreadsheet-id',
  GOOGLE_SHEETS_RANGE: "'Controle de Venda'!A:AZ",
};

describe('validateEnv Google Sheets credentials', () => {
  it('normaliza a private key com quebras de linha escapadas', () => {
    const escapedKey = `"${validPrivateKey.replace(/\n/g, '\\n')}"`;
    const result = validateEnv({ ...baseConfig, GOOGLE_SHEETS_PRIVATE_KEY: escapedKey });

    expect(result.GOOGLE_SHEETS_PRIVATE_KEY).toBe(validPrivateKey);
  });

  it('preserva uma private key PEM multilinha valida', () => {
    expect(normalizePrivateKey(validPrivateKey)).toBe(validPrivateKey);
    expect(validateEnv(baseConfig).GOOGLE_SHEETS_PRIVATE_KEY).toBe(validPrivateKey);
  });

  it('identifica o client email invalido sem expor credenciais', () => {
    expect(() =>
      validateEnv({ ...baseConfig, GOOGLE_SHEETS_CLIENT_EMAIL: 'usuario@example.com' }),
    ).toThrow('GOOGLE_SHEETS_CLIENT_EMAIL invalida');
  });

  it('identifica uma private key que nao pode ser decodificada', () => {
    const invalidKey = [
      '-----BEGIN PRIVATE KEY-----',
      'conteudo-invalido',
      '-----END PRIVATE KEY-----',
    ].join('\n');

    expect(() => validateEnv({ ...baseConfig, GOOGLE_SHEETS_PRIVATE_KEY: invalidKey })).toThrow(
      'GOOGLE_SHEETS_PRIVATE_KEY invalida',
    );
  });

  it('informa todas as variaveis ausentes quando a integracao esta ativa', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        GOOGLE_SHEETS_CLIENT_EMAIL: '',
        GOOGLE_SHEETS_PRIVATE_KEY: '',
      }),
    ).toThrow('GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY');
  });
});
