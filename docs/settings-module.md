# Modulo Configuracoes do Sistema

## Objetivo

O modulo Configuracoes centraliza os parametros globais da plataforma iNest Phone.

Ele e a fonte oficial para configuracoes gerais, financeiras, operacionais de importacao, ofertas e preferencias do usuario.

## Backend

Modulo:

- `apps/api/src/modules/settings`

Endpoints:

- `GET /api/v1/settings`
- `PATCH /api/v1/settings`
- `POST /api/v1/settings/reset-defaults`

Todos os endpoints sao protegidos por JWT.

## Persistencia

Tabelas utilizadas:

- `configuracao_sistema`
- `configuracao_financeira`
- `configuracao_financeira_importacao`
- `regra_redirecionamento_importacao`
- `log_auditoria`

Configuracoes gerais, ofertas e preferencias sao persistidas em chave/valor por escopo global.

Configuracao financeira utiliza a entidade oficial `FinancialConfiguration`.

Configuracao financeira de importacao utiliza `ImportFinancialConfiguration` e `ImportRedirectRule`.

## Auditoria

Toda atualizacao e toda restauracao de padroes registram:

- usuario responsavel;
- valores anteriores;
- valores novos;
- contexto da operacao.

## Frontend

Feature:

- `apps/web/features/settings`

Componentes principais:

- `SettingsPageContent`
- `useSettings`
- `settings-service`
- `settings.ts`

Componentes compartilhados reutilizados:

- `SettingsCard`
- `CurrencyInput`
- `PercentageInput`
- `ActionButton`
- `StatusBadge`
- `LoadingState`
- `ErrorState`
- `PageHeader`

## Consumo Futuro

Os proximos modulos deverao consumir estas configuracoes via service oficial:

- Precificacao: configuracao financeira.
- Radar de Importacao: custos operacionais de importacao.
- Gerador de Ofertas: textos e parametros padrao de ofertas.
- Interface: preferencias de tema, idioma e formatos.

Nao devem existir valores fixos espalhados nos modulos consumidores.
