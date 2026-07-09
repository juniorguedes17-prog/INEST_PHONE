# Modulo Radar de Precos

O Radar de Precos centraliza cotacoes de fornecedores usando a entidade `PriceHistory`,
mantendo Produto e Fornecedor como fontes oficiais de dados.

## Backend

Endpoints criados em `/price-radar`:

- `GET /quotes`: lista cotacoes com filtros e ordenacao.
- `GET /quotes/:id`: consulta uma cotacao.
- `POST /quotes`: cadastra cotacao.
- `PATCH /quotes/:id`: atualiza cotacao.
- `PATCH /quotes/:id/hide`: oculta logicamente a cotacao.
- `GET /kpis`: retorna menor preco valido, preco medio, maior preco e ocultados.
- `POST /import/csv`: importa CSV em texto.
- `POST /import/excel`: estrutura preparada para parser Excel futuro.
- `POST /validate`: valida qualidade conforme criterios do BRD.

## Frontend

A pagina `/price-radar` reutiliza o Design System existente:

- `PageHeader`
- `FilterSidebar`
- `KpiCard`
- `ListHeader`
- `ProductCard`
- `Modal`
- estados de loading, erro e vazio

## Importacao CSV

Cabecalho esperado:

```csv
productId,supplierId,costProduct,deliveryTime,city,quality,notes,quoteDate
```

A importacao registra inconsistencias por linha sem interromper o lote inteiro.

## Regras

Registros com criterios reprovados pelo BRD sao marcados como ocultados na resposta.
Como o schema atual de `PriceHistory` nao possui campos `status`, `deleted_at` ou
`quality`, a ocultacao operacional desta etapa usa marcador em `notes`.

## Inconsistencias do DMS/Schema

- `PriceHistory` nao possui `status`.
- `PriceHistory` nao possui `deletedAt` para soft delete.
- `PriceHistory` nao possui campo proprio de qualidade/estado.
- O suporte a Excel esta preparado por endpoint, mas sem parser binario ate autorizacao de dependencia.
