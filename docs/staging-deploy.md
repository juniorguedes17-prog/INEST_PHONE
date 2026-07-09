# Deploy de Homologacao

Este documento registra a configuracao necessaria para publicar o MVP iNest Phone em homologacao.

## Status tecnico

- Frontend Next.js: build de staging validado.
- Backend NestJS: build de staging validado.
- Prisma: schema validado.
- PostgreSQL Neon: operacional na homologacao tecnica.
- Testes API: aprovados.
- Lint: aprovado.

## Frontend - Vercel

Projeto recomendado:

- Framework: Next.js.
- Root directory: raiz do repositorio.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm --filter @inest/web build`.
- Output: `apps/web/.next`.

Variaveis obrigatorias:

```env
APP_ENV=staging
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://URL_DO_BACKEND/api/v1
NEXTAUTH_URL=https://URL_DO_FRONTEND
NEXTAUTH_SECRET=<secret-staging>
```

## Backend - Render ou Railway

Arquivo preparado:

- `render.yaml`

Configuracao esperada:

- Runtime: Docker.
- Dockerfile: `apps/api/Dockerfile`.
- Health check: `/api/v1/health`.
- Porta: `3333`.

Variaveis obrigatorias:

```env
NODE_ENV=production
APP_ENV=staging
API_PORT=3333
PORT=3333
API_PREFIX=api/v1
API_VERSION=1.0.0
SWAGGER_ENABLED=true
FRONTEND_URL=https://URL_DO_FRONTEND
BACKEND_URL=https://URL_DO_BACKEND
NEXT_PUBLIC_API_URL=https://URL_DO_BACKEND/api/v1
CORS_ORIGIN=https://URL_DO_FRONTEND
DATABASE_URL=<neon-staging-url>
JWT_SECRET=<secret-forte>
JWT_REFRESH_SECRET=<refresh-secret-forte>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
WHATSAPP_BASE_URL=https://wa.me
LOG_LEVEL=log
```

## GitHub Actions

Workflow preparado:

- `.github/workflows/staging.yml`

Secrets necessarios:

```env
STAGING_DATABASE_URL=<neon-staging-url>
VERCEL_STAGING_DEPLOY_HOOK_URL=<deploy-hook-vercel>
BACKEND_STAGING_DEPLOY_HOOK_URL=<deploy-hook-render-ou-railway>
```

## Ordem de publicacao

1. Criar o servico de backend no Render ou Railway.
2. Configurar as variaveis do backend.
3. Publicar o backend.
4. Validar `https://URL_DO_BACKEND/api/v1/health`.
5. Criar o projeto de frontend na Vercel.
6. Configurar `NEXT_PUBLIC_API_URL` apontando para o backend.
7. Configurar `CORS_ORIGIN` do backend com a URL final do frontend.
8. Publicar o frontend.
9. Executar login e validar os modulos principais.

## Validacao pos-deploy

Validar:

- Login.
- Dashboard.
- Produtos.
- Fornecedores.
- Radar de Precos.
- Precificacao.
- Radar de Importacao.
- Ofertas.
- Configuracoes.
- `/api/v1/health`.
- `/api/v1/docs`, quando `SWAGGER_ENABLED=true`.

## Pendencia externa

O deploy real depende de autenticacao/autorizacao nos provedores:

- Vercel para o frontend.
- Render ou Railway para o backend.
- GitHub, caso o deploy seja disparado via workflow.

