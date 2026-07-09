# Gerenciamento de Secrets e Credenciais

## Objetivo

Centralizar credenciais da plataforma iNest Phone em variaveis de ambiente e impedir que segredos sejam enviados ao controle de versao.

## Regra Oficial

Nenhuma credencial real deve ficar em codigo-fonte, componentes React, controllers, services, repositories, migrations, seed ou documentacao versionavel.

## Arquivos

| Arquivo | Uso | Pode conter segredo real? |
| --- | --- | --- |
| `.env.example` | Referencia segura | Nao |
| `.env.development` | Modelo de desenvolvimento | Nao |
| `.env.staging` | Modelo de homologacao | Nao |
| `.env.production` | Modelo de producao | Nao |
| `.env.local` | Credenciais locais da maquina | Sim, pois e ignorado pelo Git |

## Secrets Obrigatorios

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

## Secrets Preparados

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SHEETS_ID`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_CLIENT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `WHATSAPP_BASE_URL`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `OPENAI_API_KEY`
- `IMPORT_PROVIDER_KEY`
- `SENTRY_DSN`
- `BETTER_STACK_SOURCE_TOKEN`

## Provedores

### Desenvolvimento

Usar `.env.local` para credenciais reais locais.

### Homologacao

Cadastrar secrets diretamente no provedor:

- Vercel: variaveis do frontend.
- Render/Railway: variaveis do backend.
- Neon: credenciais do banco.

### Producao

Cadastrar secrets reais apenas nos provedores.

Nao copiar `.env.production` com valores reais para o repositorio.

## Validacao

Executar:

```bash
pnpm env:check
```

Esse comando valida a presenca das variaveis e bloqueia placeholders quando o ambiente exige segredo real.
