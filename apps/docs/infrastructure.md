# Infraestrutura da Aplicacao

## Objetivo

Este documento descreve a infraestrutura tecnica inicial da aplicacao iNest Phone.

A etapa cobre padronizacao de desenvolvimento, qualidade de codigo, ambiente Docker, variaveis de ambiente, Swagger, logs, tratamento global de erros e Health Check.

Nenhuma regra de negocio foi implementada nesta etapa.

## Estrutura

```text
apps/
  web/    Aplicacao Next.js
  api/    Aplicacao NestJS
prisma/   Schema, seed e migrations
docs/     Documentacao tecnica
```

## Ambientes

Arquivos disponiveis:

| Arquivo            | Finalidade                                           |
| ------------------ | ---------------------------------------------------- |
| `.env.example`     | Referencia de variaveis sem segredos reais.          |
| `.env.development` | Configuracao local de desenvolvimento.               |
| `.env.staging`     | Configuracao de homologacao com placeholders seguros. |
| `.env.production`  | Modelo de configuracao de producao com placeholders. |

Grupos de variaveis:

- Frontend: `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`
- Backend: `BACKEND_URL`, `API_PORT`, `PORT`, `API_PREFIX`, `API_VERSION`, `CORS_ORIGIN`
- Banco: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- JWT: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- Logs: `LOG_LEVEL`
- Swagger: `SWAGGER_ENABLED`

A especificacao completa dos ambientes esta em `docs/environment-configuration.md`.

## ESLint

O projeto possui configuracoes separadas para:

- `apps/web`: Next.js + TypeScript
- `apps/api`: NestJS + TypeScript

Comandos:

```bash
pnpm lint
pnpm lint:web
pnpm lint:api
```

## Prettier

Configuracao:

- `.prettierrc`
- `.prettierignore`

Padroes:

- aspas simples;
- ponto e virgula;
- trailing comma;
- largura maxima de 100 caracteres.

Comandos:

```bash
pnpm format
pnpm format:check
```

## Husky e lint-staged

Hooks criados:

| Hook         | Acao                                      |
| ------------ | ----------------------------------------- |
| `pre-commit` | Executa `pnpm lint-staged`.               |
| `pre-push`   | Executa lint, Prettier check e typecheck. |

O `lint-staged` aplica Prettier apenas nos arquivos modificados e executa lint nos arquivos TypeScript dos apps.

## Docker

Arquivos:

- `apps/web/Dockerfile`
- `apps/api/Dockerfile`
- `docker-compose.yml`

Servicos previstos:

| Servico    | Porta | Finalidade              |
| ---------- | ----: | ----------------------- |
| `postgres` |  5432 | Banco PostgreSQL local. |
| `api`      |  3333 | Backend NestJS.         |
| `web`      |  3000 | Frontend Next.js.       |

Comando previsto:

```bash
docker compose up --build
```

## Swagger

Swagger fica disponivel em:

```text
http://localhost:3333/api/v1/docs
```

Configuracao:

- titulo: iNest Phone API;
- descricao tecnica;
- versao por `API_VERSION`;
- autenticacao Bearer/JWT preparada para modulos futuros.

## Logs

Estrutura criada:

- `AppLoggerService`: logger global da aplicacao.
- `HttpLoggerMiddleware`: logs HTTP com metodo, rota, status e duracao.
- `AuditLoggerService`: estrutura tecnica preparada para auditoria futura.

Nenhuma auditoria de regra de negocio foi implementada nesta etapa.

## Tratamento Global de Erros

O `GlobalExceptionFilter` padroniza erros no formato:

```json
{
  "success": false,
  "message": "...",
  "error": "...",
  "timestamp": "...",
  "path": "..."
}
```

## ValidationPipe

Configuracao global:

- `whitelist: true`
- `transform: true`
- `forbidNonWhitelisted: true`

## CORS

O CORS utiliza `CORS_ORIGIN`, aceitando uma ou mais origens separadas por virgula.

Exemplo:

```text
CORS_ORIGIN="http://localhost:3000,https://app.inestphone.com.br"
```

## Health Check

Endpoint:

```text
GET /api/v1/health
```

Retorno esperado:

- status da API;
- status do banco;
- versao da API;
- timestamp.

## Scripts

Principais comandos:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm check
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
pnpm prisma:seed
```

## Observacao sobre Prisma

O schema Prisma existente nao foi alterado nesta etapa.

Durante a validacao, o Prisma apontou incompatibilidade tecnica com o uso de `@db.Numeric(...)` no conector PostgreSQL da versao atual. A correcao recomendada e substituir por `@db.Decimal(...)`, mas essa alteracao depende de autorizacao especifica por afetar o schema Prisma.
