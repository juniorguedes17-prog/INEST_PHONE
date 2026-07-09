# Modulo Dashboard Gerencial

O Dashboard e um consumidor de dados dos modulos oficiais. Ele nao recalcula precos e nao cria
regras comerciais proprias.

## Endpoints

- `GET /dashboard`
- `GET /dashboard/kpis`
- `GET /dashboard/financial`
- `GET /dashboard/radar`
- `GET /dashboard/importation`
- `GET /dashboard/offers`
- `GET /dashboard/products`
- `GET /dashboard/suppliers`

## Origem dos dados

- Produtos: `Product`
- Fornecedores: `Supplier`
- Radar de Precos: `PriceHistory`
- Importacao: auditoria `entity = import_radar`
- Ofertas: `Offer` e auditoria `entity = offers`
- Financeiro: vendas concluidas em `Sale`

## Cache

O service utiliza cache em memoria por 30 segundos por conjunto de filtros.

## Auditoria

Cada acesso ao snapshot do Dashboard registra auditoria com usuario e filtros utilizados.
