# Modulo Integracoes

O modulo Integracoes centraliza comunicacao com servicos externos por meio de interfaces e
providers. Nenhum modulo de negocio deve acessar APIs externas diretamente.

## Providers

- `GoogleSheetsProvider`: preparado para lucro por modelo, margem padrao e tabelas auxiliares.
- `WhatsappProvider`: gera links estruturados `https://wa.me/?text=...`.
- `ComprasParaguaiIntegrationProvider`: preparado para API ou scraping controlado futuro.
- `CsvExportProvider`, `ExcelExportProvider`, `PdfExportProvider`: exportacoes centralizadas.

## Endpoints

- `GET /integrations/status`
- `POST /integrations/:provider/test`
- `POST /integrations/:provider/sync`
- `POST /integrations/import`
- `POST /integrations/export`
- `POST /integrations/whatsapp/link`
- `GET /integrations/jobs`
- `GET /integrations/history`
- `DELETE /integrations/cache`

## Retry e timeout

Operacoes de provider usam `withRetry` com 2 tentativas e timeout padrao de 5 segundos.

## Cache

Status de providers fica em cache por 60 segundos. Sincronizacoes e limpeza manual invalidam o
cache.

## Scheduler

Jobs preparados:

- Atualizar dolar
- Atualizar Google Sheets
- Sincronizar fornecedores
- Limpar cache

Nesta etapa os jobs nao executam automaticamente.

## Auditoria e logs

Testes, sincronizacoes, importacoes e exportacoes sao registrados em auditoria (`entity =
integrations`) e no logger tecnico do NestJS.
