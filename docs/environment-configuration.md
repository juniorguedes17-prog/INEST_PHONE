# Configuracao de Ambientes

## Objetivo

Este documento define a configuracao oficial de ambientes da aplicacao iNest Phone.

A aplicacao deve alternar entre Desenvolvimento, Homologacao e Producao exclusivamente por variaveis de ambiente, sem alteracao de codigo-fonte.

## Arquivos de Ambiente

| Arquivo | Finalidade |
| --- | --- |
| `.env.example` | Referencia segura, sem credenciais reais. |
| `.env.development` | Desenvolvimento local ou ambiente tecnico controlado. |
| `.env.staging` | Homologacao, com comportamento semelhante a producao. |
| `.env.production` | Producao, com debug desabilitado e segredos reais no provedor. |

Os arquivos `.env.development`, `.env.staging` e `.env.production` devem permanecer fora do controle de versao.

## Variaveis Obrigatorias

### Ambiente

- `NODE_ENV`
- `APP_ENV`

### URLs

- `FRONTEND_URL`
- `BACKEND_URL`
- `NEXT_PUBLIC_API_URL`

### Backend

- `API_PORT`
- `PORT`
- `API_PREFIX`
- `API_VERSION`
- `CORS_ORIGIN`
- `LOG_LEVEL`
- `SWAGGER_ENABLED`

### Banco de Dados

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`

### Autenticacao

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

### Seed

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

### Integracoes Preparadas

- `GOOGLE_SHEETS_ENABLED`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `WHATSAPP_ENABLED`
- `WHATSAPP_BASE_URL`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_DEFAULT_MESSAGE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

### Observabilidade

- `SENTRY_DSN`
- `BETTER_STACK_SOURCE_TOKEN`
- `OPENAI_API_KEY`
- `IMPORT_PROVIDER_KEY`

## Comportamento por Ambiente

### Desenvolvimento

- `APP_ENV=development`
- `NODE_ENV=development`
- logs detalhados;
- Swagger habilitado;
- CORS liberado para `http://localhost:3000`;
- pode utilizar banco Neon tecnico ou banco local.

### Homologacao

- `APP_ENV=staging`
- `NODE_ENV=production`
- comportamento semelhante a producao;
- Swagger pode permanecer habilitado;
- logs moderados;
- credenciais devem ser configuradas no provedor.

### Producao

- `APP_ENV=production`
- `NODE_ENV=production`
- Swagger desabilitado;
- logs restritos;
- segredos obrigatoriamente fortes;
- credenciais configuradas no provedor de hospedagem.

## Scripts

Validar variaveis:

```bash
pnpm env:check
```

Executar desenvolvimento:

```bash
pnpm dev
```

Build por ambiente:

```bash
pnpm build:development
pnpm build:staging
pnpm build:production
```

## NestJS

O backend carrega automaticamente o arquivo de ambiente com base em:

1. `APP_ENV`
2. `NODE_ENV`
3. `development`, quando nenhum valor for informado.

Tambem existe validacao automatica das variaveis obrigatorias no bootstrap da aplicacao.

## Next.js

O frontend consome variaveis publicas via `NEXT_PUBLIC_*`.

Para alterar a API utilizada pelo frontend, atualizar:

```text
NEXT_PUBLIC_API_URL
```

## Seguranca

Arquivos com credenciais reais nao devem ser versionados.

Segredos de homologacao e producao devem ser cadastrados diretamente no provedor de hospedagem.

Credenciais reais usadas localmente devem ficar em `.env.local`.

O arquivo `.env.local` e ignorado pelo Git e deve sobrescrever apenas os valores sensiveis necessarios para desenvolvimento.

Nunca utilizar em producao:

- `change-me`
- `development-only-change-me`
- `replace-with-*`
- senhas temporarias de seed.
